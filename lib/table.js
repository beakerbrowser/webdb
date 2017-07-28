const anymatch = require('anymatch')
const EventEmitter = require('events')

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

  isRecordFile (filepath) {
    return anymatch(this._pathPattern, filepath)
  }

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

  add (url, record) {
    // TODO (url|DatArchive, record) => Promise<url>
  }

  count () {
    // TODO () => Promise<Number>
  }

  delete (url) {
    // TODO (url) => Promise<url>
  }

  each (fn) {
    // TODO (Function) => Promise<Void>
  }

  filter (fn) {
    // TODO (Function) => InjestRecordset
  }

  get (urlOrQuery) {
    // TODO (url | query) => Promise<InjestArchive>
  }

  limit (n) {
    // TODO (Number) => InjestRecordset
  }

  offset (n) {
    // TODO (Number) => InjestRecordset
  }

  orderBy (index) {
    // TODO (index) => InjestRecordset
  }

  reverse () {
    // TODO () => InjestRecordset
  }

  toArray () {
    // TODO () => Promise<Array>
  }

  toCollection () {
    // TODO () => InjestRecordset
  }

  update (url, record) {
    // TODO (url, record) => Promise<url>
  }

  where (indexOrQuery) {
    // TODO (index|query) => InjestWhereClause|InjestRecordset
  }
}
module.exports = InjestTable