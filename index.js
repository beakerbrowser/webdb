/* globals window */

const EventEmitter = require('events')
const level = require('level-browserify')
const sublevel = require('subleveldown')
const levelPromisify = require('level-promise')
const {debug, veryDebug, assert, getObjectChecksum, URL} = require('./lib/util')
const {SchemaError} = require('./lib/errors')
const TableDef = require('./lib/table-def')
const Indexer = require('./lib/indexer')
const WebDBTable = require('./lib/table')
const flatten = require('lodash.flatten')

class WebDB extends EventEmitter {
  constructor (name, opts = {}) {
    super()
    if (typeof window === 'undefined' && !opts.DatArchive) {
      throw new Error('Must provide {DatArchive} opt when using WebDB outside the browser.')
    }
    this.level = false
    this.name = name
    this.isBeingOpened = false
    this.isOpen = false
    this.DatArchive = opts.DatArchive || window.DatArchive
    this._indexMetaLevel = null
    this._tableSchemaLevel = null
    this._tableDefs = {}
    this._archives = {}
    this._tablesToRebuild = []
    this._activeSchema = null
    this._tableFilePatterns = []
    this._dbReadyPromise = new Promise((resolve, reject) => {
      this.once('open', () => resolve(this))
      this.once('open-failed', reject)
    })
  }

  async open () {
    // guard against duplicate opens
    if (this.isBeingOpened || this.level) {
      veryDebug('duplicate open, returning ready promise')
      return this._dbReadyPromise
    }
    if (this.isOpen) {
      return
    }
    this.isBeingOpened = true // TODO needed?
    var neededRebuilds = []

    // open the db
    debug('opening')
    try {
      this.level = level(this.name, {valueEncoding: 'json'})
      this._tableSchemaLevel = sublevel(this.level, '_tableSchema', {valueEncoding: 'json'})
      levelPromisify(this._tableSchemaLevel)
      this._indexMetaLevel = sublevel(this.level, '_indexMeta', {valueEncoding: 'json'})
      levelPromisify(this._indexMetaLevel)

      // construct the tables
      const tableNames = Object.keys(this._tableDefs)
      debug('adding tables', tableNames)
      tableNames.forEach(tableName => {
        this[tableName] = new WebDBTable(this, tableName, this._tableDefs[tableName])
        this._tableFilePatterns.push(this[tableName]._filePattern)
      })
      this._tableFilePatterns = flatten(this._tableFilePatterns)

      // detect table-definition changes
      for (let i = 0; i < tableNames.length; i++) {
        let tableName = tableNames[i]
        let tableChecksum = this._tableDefs[tableName].checksum

        // load the saved checksum
        let lastChecksum
        try { 
          let tableMeta = await this._tableSchemaLevel.get(tableName)
          lastChecksum = tableMeta.checksum
        } catch (e) {}
        
        // compare
        if (lastChecksum !== tableChecksum) {
          neededRebuilds.push(tableName)
        }
      }

      // run rebuilds
      // TODO go per-table
      await Indexer.resetOutdatedIndexes(this, neededRebuilds)
      this.emit('indexes-reset')

      // save checksums
      for (let i = 0; i < tableNames.length; i++) {
        let tableName = tableNames[i]
        let tableChecksum = this._tableDefs[tableName].checksum
        await this._tableSchemaLevel.put(tableName, {checksum: tableChecksum})
      }

      this.isBeingOpened = false
      this.isOpen = true

      // events
      debug('opened')
      this.emit('open')
    } catch (e) {
      console.error('Upgrade has failed', e)
      this.isBeingOpened = false
      this.emit('open-failed', e)
      throw e
    }

    return {
      rebuilds: neededRebuilds
    }
  }

  async close () {
    if (!this.isOpen) return
    debug('closing')
    this.isOpen = false
    if (this.level) {
      this.listSources().forEach(url => Indexer.unwatchArchive(this, this._archives[url]))
      this._archives = {}
      await new Promise(resolve => this.level.close(resolve))
      this.level = null
      veryDebug('db .level closed')
    } else {
      veryDebug('db .level didnt yet exist')
    }
  }

  async delete () {
    if (this.isOpen) {
      await this.close()
    }
    await WebDB.delete(this.name)
  }

  define (tableName, definition) {
    assert(!this.level && !this.isBeingOpened, SchemaError, 'Cannot define a table when database is open')
    let checksum = getObjectChecksum(definition)
    TableDef.validateAndSanitize(definition)
    definition.checksum = checksum
    this._tableDefs[tableName] = definition
  }

  get tables () {
    return Object.keys(this._tableDefs)
      .filter(name => !name.startsWith('_'))
      .map(name => this[name])
  }

  async indexArchive (archive, opts = {}) {
    opts.watch = (typeof opts.watch === 'boolean') ? opts.watch : true

    // handle array case
    if (Array.isArray(archive)) {
      return Promise.all(archive.map(a => this.indexArchive(a, opts)))
    }

    // create our own new DatArchive instance
    archive = typeof archive === 'string' ? new (this.DatArchive)(archive, opts.dat) : archive
    if (!(archive.url in this._archives)) {
      // store and process
      debug('WebDB.indexArchive', archive.url)
      this._archives[archive.url] = archive
      await Indexer.addArchive(this, archive, opts)
    }
  }

  async unindexArchive (archive, opts = {}) {
    archive = typeof archive === 'string' ? new (this.DatArchive)(archive, opts.dat) : archive
    if (archive.url in this._archives) {
      debug('WebDB.unindexArchive', archive.url)
      delete this._archives[archive.url]
      await Indexer.removeArchive(this, archive)
    }
  }

  async indexFile (archive, filepath) {
    if (typeof archive === 'string') {
      const urlp = new URL(archive)
      archive = new (this.DatArchive)(urlp.protocol + '//' + urlp.hostname)
      return this.indexFile(archive, urlp.pathname)
    }
    await Indexer.readAndIndexFile(this, archive, filepath)
  }

  async unindexFile (archive, filepath) {
    if (typeof archive === 'string') {
      const urlp = new URL(archive)
      archive = new (this.DatArchive)(urlp.protocol + '//' + urlp.hostname)
      return this.indexFile(archive, urlp.pathname)
    }
    await Indexer.unindexFile(this, archive, filepath)
  }

  listSources () {
    return Object.keys(this._archives)
  }

  isSource (url) {
    if (!url) return false
    if (url.url) url = url.url // an archive
    return (url in this._archives)
  }

  static list () {
    // TODO
  }

  static delete (name) {
    if (typeof level.destroy !== 'function') {
      throw new Error('Cannot .delete() databases outside of the browser environment. You should just delete the files manually.')
    }

    // delete the database from indexeddb
    return new Promise((resolve, reject) => {
      level.destroy(name, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
module.exports = WebDB

