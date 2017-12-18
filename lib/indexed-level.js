/*
Indexed Level

Adds secondary indexes to the Level API

How it works:
- Inputs: a level to wrap, and a set of index descriptions.
- Populates a `.indexes` with read-only `Index` objects (.get, .createReadStream, etc).
- Wraps put() and del() so that each index is atomically updated.

Each index has a sublevel which maps record values to record keys.
For example, a username to userid index:
  Alice => [user-8]
  Bob   => [user-5, user-12]
  Carla => [user-2]
*/

const extend = require('xtend')
const levelPromisify = require('level-promise')
const sublevel = require('subleveldown')
const Readable = require('stream').Readable
const makeId = require('monotonic-timestamp-base36')
const {veryDebug, lock} = require('./util')

module.exports = (rootLevel, indexSpecs) => {
  // modernize the api
  const level = sublevel(rootLevel, '_', {valueEncoding: 'json'})
  levelPromisify(level)

  // add indexes
  var indexes = {}
  indexSpecs.forEach(spec => {
    const name = normalizeIndexDef(spec.name)
    indexes[name] = new Index(level, sublevel(rootLevel, name, {valueEncoding: 'json'}), spec)
  })

  async function addIndexes (key, value) {
    await Promise.all(Object.keys(indexes).map(i => indexes[i].addToIndex(key, value)))
  }

  async function removeIndexes (key, value) {
    await Promise.all(Object.keys(indexes).map(i => indexes[i].removeFromIndex(key, value)))
  }

  // return wrapped API
  return {
    indexes,

    get: level.get.bind(level),
    createReadStream: level.createReadStream.bind(level),
    createKeyStream: level.createKeyStream.bind(level),
    createValueStream: level.createValueStream.bind(level),

    async put (key, value, opts) {
      var release = await lock('il:mutate:' + key)
      try {
        try {
          var oldValue = await this.get(key)
          await removeIndexes(key, oldValue)
        } catch (e) {}
        await level.put(key, value, opts)
        await addIndexes(key, value)
      } finally {
        release()
      }
    },

    async del (key, opts) {
      var release = await lock('il:mutate:' + key)
      try {
        try {
          var oldValue = await this.get(key)
          await removeIndexes(key, oldValue)
        } catch (e) {}
        await level.del(key, opts)
      } finally {
        release()
      }
    }
  }
}

class Index {
  constructor (parentLevel, level, spec) {
    this._lockId = makeId() + '!' // create a unique lock id
    this.parentLevel = parentLevel
    this.level = level
    levelPromisify(this.level)
    this.spec = {name: spec.name, def: arrayify(spec.def)}
    this.isMultiEntry = this.spec.def[0].startsWith('*')
    this.keyPaths = this.spec.def.map(def => normalizeIndexDef(def).split('+'))
  }

  async get (key, opts) {
    var recordKey = await this.level.get(toKey(key))
    return this.parentLevel.get(recordKey[0], opts)
  }

  createValueStream (opts = {}) {
    opts.keys = false
    return this.createReadStream(opts)
  }

  createKeyStream (opts = {}) {
    opts.values = false
    return this.createReadStream(opts)
  }

  createReadStream (opts = {}) {
    // start read stream using the given params
    var opts2 = extend({}, opts)
    opts2.keys = opts2.values = true
    opts2.lt = toKey(opts2.lt)
    opts2.lte = toKey(opts2.lte)
    opts2.gt = toKey(opts2.gt)
    opts2.gte = toKey(opts2.gte)
    var rs = this.level.createReadStream(opts2)

    // start our output stream
    var outs = new Readable({ objectMode: true, read () {} })

    // each value in our sublevel is an array of record keys
    // as `rs` emits record-key arrays, we'll read the corresponding record values and emit them on `outs`
    var inFlight = 1
    rs.on('data', ({key, value}) => {
      value.forEach(async recordKey => {
        if (opts.values === false) {
          return outs.push(recordKey)
        }

        try {
          inFlight++
          let value = await this.parentLevel.get(recordKey)
          inFlight--
          if (opts.keys === false) {
            outs.push(value)
          } else {
            outs.push({key: recordKey, value})
          }
        } catch (err) {
          if (err.notFound) {
            // our index got out of date somehow, ignore
          } else {
            outs.destroy(err)
          }
        }

        checkDone()
      })
    })
    rs.on('error', err => outs.destroy(err))
    rs.on('end', () => {
      inFlight--
      checkDone()
    })

    function checkDone () {
      if (inFlight === 0) {
        outs.push(null)
      }
    }

    return outs
  }

  addToIndex (recordKey, recordWrapper) {
    // iterate all of the indexable keys on the record
    return Promise.all(createKeysFromRecord(this, recordWrapper).map(async indexKey => {
      var release = await lock(this._lockId + indexKey)
      try {
        // fetch the current index value
        try {
          var indexValues = await this.level.get(indexKey)
        } catch (e) {}
        indexValues = indexValues || []

        // add the new record key
        if (indexValues.indexOf(recordKey) === -1) {
          indexValues.push(recordKey)
        }

        // write/del
        if (indexValues.length > 0) {
          await this.level.put(indexKey, indexValues)
        } else {
          await this.level.del(indexKey)
        }
      } finally {
        release()
      }
    }))
  }

  removeFromIndex (recordKey, recordWrapper) {
    // iterate all of the indexable keys on the record
    return Promise.all(createKeysFromRecord(this, recordWrapper).map(async indexKey => {
      var release = await lock(this._lockId + indexKey)
      try {
        // fetch the current index value
        try {
          var indexValues = await this.level.get(indexKey)
        } catch (e) {}
        indexValues = indexValues || []

        // remove the old record key
        let i = indexValues.indexOf(recordKey)
        if (i !== -1) {
          indexValues.splice(i, 1)
        }

        // write/del
        if (indexValues.length > 0) {
          await this.level.put(indexKey, indexValues)
        } else {
          await this.level.del(indexKey)
        }
      } finally {
        release()
      }
    }))
  }
}

function arrayify (v) {
  if (typeof v === 'undefined') return []
  return Array.isArray(v) ? v : [v]
}

function toKey (key) {
  if (typeof key === 'undefined') return undefined
  if (Array.isArray(key)) return key.join('!')
  return key
}

function createKeysFromRecord (index, recordWrapper) {
  // look for the first keypath to match full on the record
  // if no paths match, then return an empty array

  const tryKeypath = (index.isMultiEntry)
    ? (keyPath) => {
      // multi-entry, look for value and then arrayify
      var values = lookupRecordValue(recordWrapper, keyPath[0])
      if (typeof values === 'undefined') return false
      return arrayify(values)
    }
    : (keyPath) => {
      // simple or compound, look for fully matching path
      var path = []
      for (let i = 0; i < keyPath.length; i++) {
        let key = keyPath[i]
        let value = lookupRecordValue(recordWrapper, key)
        if (typeof value === 'undefined' || typeof value === 'object') return false
        path.push(value)
      }
      return [path.join('!')]
    }

  // try each possible keypath till a match is found
  for (let i = 0; i < index.keyPaths.length; i++) {
    let res = tryKeypath(index.keyPaths[i])
    if (res) return res
  }
  return []
}

function lookupRecordValue (recordWrapper, key) {
  if (key === ':url') return recordWrapper.url
  if (key === ':origin') return recordWrapper.origin
  if (key === ':indexedAt') return recordWrapper.indexedAt
  return recordWrapper.record[key]
}

function normalizeIndexDef (index) {
  if (index.startsWith('*')) return index.slice(1)
  return index
}
