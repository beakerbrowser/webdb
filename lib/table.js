const anymatch = require('anymatch')
const EventEmitter = require('events')
const InjestRecordSet = require('./record-set')
const {assert} = require('./util')
const {ParameterError} = require('./errors')

// exported api
// =

class InjestTable extends EventEmitter {
  constructor (idb, name, schema) {
    super()
    this.idb = idb
    this.name = name
    this.schema = schema
    this._pathPattern = schema.singular ? `/${name}.json` : `/${name}${'/*'}.json`
    // ^ HACKERY: the ${'/*'} is to fool sublime's syntax highlighting -prf
  }

  // queries
  // =

  // () => InjestRecordset
  getRecordSet () {
    return new InjestRecordSet(this)
  }

  // (url|DatArchive, record) => Promise<url>
  async add (url, record) {
    // TODO
  }

  // () => Promise<Number>
  async count () {
    return this.getRecordSet().count()
  }

  // (url) => Promise<url>
  async delete (url) {
    // TODO
  }

  // (Function) => Promise<Void>
  async each (fn) {
    return this.getRecordSet().each(fn)
  }

  // (Function) => InjestRecordset
  filter (fn) {
    return this.getRecordSet().filter(fn)
  }

  // (url | query) => Promise<InjestArchive>
  async get (urlOrQuery) {
    assert(!!urlOrQuery, ParameterError, 'Must provide a url or query to table.get()')
    if (typeof urlOrQuery === 'string') {
      return this.where('_url').is(urlOrQuery).first()
    } else if (typeof urlOrQuery === 'object') {
      return this.where(urlOrQuery).first()
    }
    throw new ParameterError('Must provide either a url (string) or query (object) to table.get()')
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

  // (url, record) => Promise<url>
  async update (url, record) {
    // TODO
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

module.exports = InjestTable
