const anymatch = require('anymatch')
const EventEmitter = require('events')
const InjestLevel = require('injestdb-level')
const Indexer = require('./indexer')
const InjestQuery = require('./query')
const {assert, debug, veryDebug, lock, toArchiveUrl} = require('./util')
const {ParameterError, QueryError} = require('./errors')

// exported api
// =

class InjestTable extends EventEmitter {
  constructor (db, name, schema) {
    super()
    this.db = db
    this.name = name
    this.schema = schema
    veryDebug('InjestTable', this.name, this.schema)
    this._pathPattern = schema.singular ? `/${name}.json` : `/${name}${'/*'}.json`
    // ^ HACKERY: the ${'/*'} is to fool sublime's syntax highlighting -prf

    // construct db object
    this.level = InjestLevel(db.level.sublevel(name), schema.index)
  }

  // queries
  // =

  // () => InjestQuery
  query () {
    return new InjestQuery(this)
  }

  // (DatArchive, record) => Promise<url>
  async add (archive, record, __releaseLock = null) {
    assert(archive && (typeof archive === 'string' || typeof archive.url === 'string'), ParameterError, 'The first parameter of .add() must be an archive or url')
    assert(record && typeof record === 'object', ParameterError, 'The second parameter of .add() must be a record object')

    // run validation
    if (this.schema.validator) {
      record = this.schema.validator(record)
    }

    // run to-file pass
    const fileData = (this.schema.toFile) ?
      this.schema.toFile(record) :
      record

    // lookup the archive
    archive = this.db._archives[typeof archive === 'string' ? archive : archive.url]
    if (!archive) {
      throw new QueryError('Unable to add(): the given archive is not part of the index')
    }
    if (!archive.isWritable) {
      throw new QueryError('Unable to add(): the given archive is not owned by this user')
    }

    // build the path
    var filepath
    if (this.schema.singular) {
      filepath = `/${this.name}.json`
    } else {
      let key = record[this.schema.primaryKey]
      if (!key) throw new QueryError(`Unable to add(): the given record is missing the primary key attribute, ${this.schema.primaryKey}`)
      filepath = `/${this.name}/${key}.json`
    }
    debug('Table.add', filepath)
    veryDebug('Table.add archive', archive.url)
    veryDebug('Table.add record', record)
    var release = __releaseLock ? __releaseLock : await lock(toArchiveUrl(archive))
    try {
      await archive.writeFile(filepath, JSON.stringify(fileData))
      if (typeof archive.commit === 'function') {
        // legacy api
        await archive.commit()
      }
      await Indexer.indexArchive(this.db, archive)
      return archive.url + filepath
    } finally {
      release()
    }
  }

  // () => Promise<Number>
  async count () {
    return this.query().count()
  }

  // (url|DatArchive, key?) => Promise<url>
  async delete (urlOrArchive, key) {
    if (typeof urlOrArchive === 'string') {
      return this.where('_url').equals(urlOrArchive).delete()
    }
    const filepath = (this.schema.singular)
      ? `/${this.name}.json`
      : `/${this.name}/${key}.json`
    const url = urlOrArchive.url + filepath
    return this.where('_url').equals(url).delete()
  }

  // (Function) => Promise<Void>
  async each (fn) {
    return this.query().each(fn)
  }

  // (Function) => InjestQuery
  filter (fn) {
    return this.query().filter(fn)
  }

  // (url) => Promise<Object>
  // (archive) => Promise<Object>
  // (archive, key) => Promise<Object>
  // (index, value) => Promise<Object>
  async get (...args) {
    if (args.length === 2) {
      if (typeof args[0] === 'string' && args[0].indexOf('://') === -1) {
        return getByKeyValue(this, ...args)
      }
      return getMultiByKey(this, ...args)
    }
    if (typeof args[0] === 'string' && args[0].endsWith('.json')) {
      return getByRecordUrl(this, ...args)
    }
    return getSingle(this, args[0])
  }

  // (Number) => InjestQuery
  limit (n) {
    return this.query().limit(n)
  }

  // (Number) => InjestQuery
  offset (n) {
    return this.query().offset(n)
  }

  // (index) => InjestQuery
  orderBy (index) {
    return this.query().orderBy(index)
  }

  // () => InjestQuery
  reverse () {
    return this.query().reverse()
  }

  // () => Promise<Array>
  async toArray () {
    return this.query().toArray()
  }

  // (record) => Promise<Number>
  // (url, updates) => Promise<Number>
  // (archive, updates) => Promise<Number>
  // (archive, key, updates) => Promise<Number>
  async update (...args) {
    if (args.length === 3) {
      return updateByKey(this, ...args)
    }
    if (args.length === 2) {
      if (this.schema.singular && typeof args[0] === 'object') {
        return updateSingular(this, ...args)
      }
      return updateByUrl(this, ...args)
    }
    return updateRecord(this, ...args)
  }

  // (url|archive, Object|Function) => Promise<Void | url>
  async upsert (archive, objOrFn) {
    assert(archive && (typeof archive === 'string' || typeof archive.url === 'string'), ParameterError, 'The first parameter of .upsert() must be an archive or url')
    assert(objOrFn && (typeof objOrFn === 'object' || typeof objOrFn === 'function'), ParameterError, 'The second parameter of .upsert() must be a record object or an update function')

    // update or add
    var release = await lock(toArchiveUrl(archive))
    try {
      var changes = (this.schema.singular)
        ? await updateSingular(this, archive, objOrFn, release)
        : await updateByUrl(this, archive, objOrFn, release)
      if (changes === 0) {
        return this.add(archive, typeof objOrFn === 'function' ? objOrFn() : objOrFn)
      }
      return changes
    } finally {
      release()
    }
  }

  // (index|query) => InjestWhereClause|InjestQuery
  where (indexOrQuery) {
    return this.query().where(indexOrQuery)
  }

  // record helpers
  // =

  // (String) => Boolean
  isRecordFile (filepath) {
    return anymatch(this._pathPattern, filepath)
  }

  // (DatArchive) => Array<Object>
  async listRecordFiles (archive) {
    try {
      if (this.schema.singular) {
        // check if the record exists on this archive
        let filepath = `/${this.name}.json`
        await archive.stat(filepath)
        return [{recordUrl: archive.url + filepath, table: this}]
      } else {
        // scan for matching records
        let records = await archive.readdir(this.name)
        return records.filter(name => name.endsWith('.json')).map(name => {
          return {
            recordUrl: archive.url + '/' + this.name + '/' + name,
            table: this
          }
        })
      }
    } catch (e) {
      return []
    }
  }
}

function getByKeyValue (table, key, value) {
  debug('getByKeyValue')
  veryDebug('getByKeyValue table', table.name)
  veryDebug('getByKeyValue key', key)
  veryDebug('getByKeyValue value', value)
  return table.where(key).equals(value).first()
}

function getMultiByKey (table, archive, key) {
  debug('getMultiByKey')
  veryDebug('getMultiByKey table', table.name)
  veryDebug('getMultiByKey archive', archive)
  veryDebug('getMultiByKey key', key)
  var url = typeof archive === 'string' ? archive : archive.url
  return table.where('_url').equals(`${url}/${table.name}/${key}.json`).first()
}

function getSingle (table, archive) {
  debug('getSingle')
  veryDebug('getSingle table', table.name)
  veryDebug('getSingle archive', archive)
  var url = typeof archive === 'string' ? archive : archive.url
  return table.where('_url').equals(`${url}/${table.name}.json`).first()
}

function getByRecordUrl (table, url) {
  debug('getByRecordUrl')
  veryDebug('getByRecordUrl table', table.name)
  veryDebug('getByRecordUrl url', url)
  return table.where('_url').equals(url).first()
}

async function updateByKey (table, archive, key, updates, __releaseLock = null) {
  debug('updateByKey')
  veryDebug('updateByKey table', table.name)
  veryDebug('updateByKey archive', archive.url)
  veryDebug('updateByKey key', key)
  veryDebug('updateByKey updates', updates)
  assert(archive && typeof archive.url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(typeof key === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && (typeof updates === 'object' || typeof updates === 'function'), ParameterError, 'Invalid parameters given to update()')

  var release = __releaseLock ? __releaseLock : await lock(toArchiveUrl(archive))
  try {
    return table.where(table.schema.primaryKey).equals(key).update(updates)
  } finally {
    release()
  }
}

async function updateSingular (table, archive, updates, __releaseLock = null) {
  debug('updateSingular')
  veryDebug('updateSingular table', table.name)
  veryDebug('updateSingular archive', archive.url)
  veryDebug('updateSingular updates', updates)
  assert(archive && typeof archive.url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && (typeof updates === 'object' || typeof updates === 'function'), ParameterError, 'Invalid parameters given to update()')

  var release = __releaseLock ? __releaseLock : await lock(toArchiveUrl(archive))
  try {
    const url = archive.url + `/${table.name}.json`
    return table.where('_url').equals(url).update(updates)
  } finally {
    release()
  }
}

async function updateByUrl (table, url, updates, __releaseLock = null) {
  debug('updateByUrl')
  url = url && url.url ? url.url : url
  veryDebug('updateByUrl table', table.name)
  veryDebug('updateByUrl url', url)
  veryDebug('updateByUrl updates', updates)
  assert(typeof url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && (typeof updates === 'object' || typeof updates === 'function'), ParameterError, 'Invalid parameters given to update()')
  if (url.endsWith('.json') === false && typeof updates === 'object') {
    // this is probably the url of an archive - add the path
    url += (url.endsWith('/') ? '' : '/') + table.name + '/' + updates[table.schema.primaryKey] + '.json'
  }

  var release = __releaseLock ? __releaseLock : await lock(toArchiveUrl(url))
  try {
    return table.where('_url').equals(url).update(updates)
  } finally {
    release()
  }
}

async function updateRecord (table, record, __releaseLock = null) {
  debug('updateRecord')
  veryDebug('updateRecord table', table.name)
  veryDebug('updateRecord record', record)
  assert(record && typeof record._url === 'string', ParameterError, 'Invalid parameters given to update()')

  var release = __releaseLock ? __releaseLock : await lock(toArchiveUrl(record._url))
  try {
    return table.where('_url').equals(record._url).update(record)
  } finally {
    release()
  }
}

module.exports = InjestTable
