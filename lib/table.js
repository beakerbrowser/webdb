const anymatch = require('anymatch')
const EventEmitter = require('events')
const Indexer = require('./indexer')
const InjestRecordSet = require('./record-set')
const {assert, debug, veryDebug} = require('./util')
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
  }

  // queries
  // =

  // () => InjestRecordset
  getRecordSet () {
    return new InjestRecordSet(this)
  }

  // (DatArchive, record) => Promise<url>
  async add (archive, record) {
    assert(archive && (typeof archive === 'string' || typeof archive.url === 'string'), ParameterError, 'The first parameter of .add() must be an archive or url')
    assert(record && typeof record === 'object', 'The second parameter of .add() must be a record object')

    // run validation
    if (this.schema.validator) {
      record = this.schema.validator(record)
    }

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
      if (!key) throw new QueryError(`Unable to add(): the given archive is missing the primary key attribute, ${this.schema.primaryKey}`)
      filepath = `/${this.name}/${key}.json`
    }
    debug('Table.add', filepath)
    veryDebug('Table.add archive', archive.url)
    veryDebug('Table.add record', record)
    await archive.writeFile(filepath, JSON.stringify(record))
    await archive.commit()
    await Indexer.waitTillIndexed(this.db, archive)
    return archive.url + filepath
  }

  // () => Promise<Number>
  async count () {
    return this.getRecordSet().count()
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
    return this.getRecordSet().each(fn)
  }

  // (Function) => InjestRecordset
  filter (fn) {
    return this.getRecordSet().filter(fn)
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

  // (Number) => InjestRecordset
  limit (n) {
    return this.getRecordSet().limit(n)
  }

  // (Number) => InjestRecordset
  offset (n) {
    return this.getRecordSet().offset(n)
  }

  // (index) => InjestRecordset
  orderBy (index) {
    return this.getRecordSet().orderBy(index)
  }

  // () => InjestRecordset
  reverse () {
    return this.getRecordSet().reverse()
  }

  // () => Promise<Array>
  async toArray () {
    return this.getRecordSet().toArray()
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

  // (url, updates) => Promise<Void | url>
  // (archive, updates) => Promise<Void | url>
  async upsert (archive, record) {
    assert(archive && (typeof archive === 'string' || typeof archive.url === 'string'), ParameterError, 'The first parameter of .upsert() must be an archive or url')
    assert(record && typeof record === 'object', 'The second parameter of .upsert() must be a record object')
    var changes = await this.update(archive, record)
    if (changes === 0) {
      return this.add(archive, record)
    }
    return changes
  }

  // (index|query) => InjestWhereClause|InjestRecordset
  where (indexOrQuery) {
    return this.getRecordSet().where(indexOrQuery)
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
            recordUrl: archive.url + this.name + '/' + name,
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
  veryDebug('getByKeyValue table', table)
  veryDebug('getByKeyValue key', key)
  veryDebug('getByKeyValue value', value)
  return table.where(key).equals(value).first()
}

function getMultiByKey (table, archive, key) {
  debug('getMultiByKey')
  veryDebug('getMultiByKey table', table)
  veryDebug('getMultiByKey archive', archive)
  veryDebug('getMultiByKey key', key)
  var url = typeof archive === 'string' ? archive : archive.url
  return table.where('_url').equals(`${url}/${table.name}/${key}.json`).first()
}

function getSingle (table, archive) {
  debug('getSingle')
  veryDebug('getSingle table', table)
  veryDebug('getSingle archive', archive)
  var url = typeof archive === 'string' ? archive : archive.url
  return table.where('_url').equals(`${url}/${table.name}.json`).first()
}

function getByRecordUrl (table, url) {
  debug('getByRecordUrl')
  veryDebug('getByRecordUrl table', table)
  veryDebug('getByRecordUrl url', url)
  return table.where('_url').equals(url).first()
}

function updateByKey (table, archive, key, updates) {
  debug('updateByKey')
  veryDebug('updateByKey table', table)
  veryDebug('updateByKey archive', archive.url)
  veryDebug('updateByKey key', key)
  veryDebug('updateByKey updates', updates)
  assert(archive && typeof archive.url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(typeof key === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && typeof updates === 'object', ParameterError, 'Invalid parameters given to update()')
  const url = archive.url + `/${table.name}/${key}.json`
  return table.where(table.schema.primaryKey).equals(key).update(updates)
}

function updateSingular (table, archive, updates) {
  debug('updateSingular')
  veryDebug('updateSingular table', table)
  veryDebug('updateSingular archive', archive.url)
  veryDebug('updateSingular updates', updates)
  assert(archive && typeof archive.url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && typeof updates === 'object', ParameterError, 'Invalid parameters given to update()')
  const url = archive.url + `/${table.name}.json`
  return table.where('_url').equals(url).update(updates)
}

function updateByUrl (table, url, updates) {
  debug('updateByUrl')
  veryDebug('updateByUrl table', table)
  veryDebug('updateByUrl url', url)
  veryDebug('updateByUrl updates', updates)
  url = url && url.url ? url.url : url
  assert(typeof url === 'string', ParameterError, 'Invalid parameters given to update()')
  assert(updates && typeof updates === 'object', ParameterError, 'Invalid parameters given to update()')
  if (url.endsWith('.json') === false) {
    // this is probably the url of an archive - add the path
    url += (url.endsWith('/') ? '' : '/') + table.name + '/' + updates[table.schema.primaryKey] + '.json'
  }
  return table.where('_url').equals(url).update(updates)
}

function updateRecord (table, record) {
  debug('updateRecord')
  veryDebug('updateRecord table', table)
  veryDebug('updateRecord record', record)
  assert(record && typeof record._url === 'string', ParameterError, 'Invalid parameters given to update()')
  return table.where('_url').equals(record._url).update(record)
}

module.exports = InjestTable
