const through2 = require('through2')
const {assert, debug, veryDebug} = require('./util')

exports.update = async function (db, key, updates) {
  key = toKey(key)
  assert(updates && typeof updates === 'object')
  var record = await db.get(key)
  record = record || {}
  for (var k in updates) {
    record[k] = updates[k]
  }
  await db.put(key, record)
}

exports.clear = async function (db) {
  return new Promise((resolve, reject) => {
    var stream = db.createKeyStream()
      .pipe(through2.obj((key, enc, cb) => db.del(key).then(cb, cb)))
      .on('error', reject)
      .on('end', () => resolve())
    stream.resume()
  })
}

exports.iterate = async function (query, fn) {
  return new Promise((resolve, reject) => {
    debug('Lev.iterate', query._table.name)

    // select the sublevel for the query
    var index
    const {_table, _where} = query
    if (_where && _where._index !== ':url') {
      veryDebug('Lev.iterate setting stream factory to index', _where._index)
      index = _table.level.indexes[_where._index]
      if (!index) {
        return reject(new Error('Invalid index: ' + _where._index))
      }
    } else {
      veryDebug('Lev.iterate using default stream factory')
      index = _table.level
    }

    // slice opts
    var {_offset, _limit} = query
    _offset = _offset || 0
    _limit = _limit || false
    veryDebug('Lev.iterate offset', _offset, 'limit', _limit)
    veryDebug('Lev.iterate where', query._where)

    // start stream
    var resultIndex = 0
    var numEmitted = 0
    var isDone = false
    var stream = index.createValueStream(makeStreamOpts(query))
    stream.on('data', value => {
      if (isDone) return
      veryDebug('data', value)
      let record = value.record
      if (record) {
        record.getRecordURL = () => value.url
        record.getRecordOrigin = () => value.origin
        record.getIndexedAt = () => value.indexedAt
      } else {
        record = value
      }
      if (resultIndex >= _offset && applyFilters(query, record)) {
        // iter call
        veryDebug('emitting')
        fn(record)
        veryDebug('emitted')
        numEmitted++
      }
      resultIndex++
      if (_limit && numEmitted >= _limit || applyUntil(query, record)) {
        // hit limit/until, stop here
        isDone = true
        veryDebug('done')
        // TODO we need to figure out how to stop the stream -prf
        resolve()
      }
    })
    stream.on('error', err => {
      veryDebug('stream error', err)
      reject(err)
    })
    stream.on('end', resolve)
    stream.resume()
  })
}

// internal methods
// =

function toKey (key) {
  if (Array.isArray(key)) {
    return key.join('!')
  }
  return key
}

function makeStreamOpts (query) {
  const {_reverse, _where} = query
  const opts = {reverse: _reverse}
  if (_where) {
    if (_where._only) {
      opts.gte = opts.lte = _where._only
    } else {
      if (typeof _where._lowerBound !== 'undefined') {
        let key = _where._lowerBoundInclusive ? 'gte' : 'gt'
        opts[key] = _where._lowerBound
      }
      if (typeof _where._upperBound !== 'undefined') {
        let key = _where._upperBoundInclusive ? 'lte' : 'lt'
        opts[key] = _where._upperBound
      }
    }
  }
  veryDebug('stream opts', opts)
  return opts
}

function applyFilters (query, value) {
  for (let i = 0; i < query._filters.length; i++) {
    if (!query._filters[i](value)) {
      return false
    }
  }
  return true
}

function applyUntil (query, value) {
  return (query._until && query._until(value))
}
