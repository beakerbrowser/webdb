/* globals window */

const EventEmitter = require('events')
const level = require('level-browserify')
const sublevel = require('level-sublevel')
const levelPromisify = require('level-promise')
const {debug, veryDebug, assert, getObjectChecksum} = require('./lib/util')
const {SchemaError} = require('./lib/errors')
const TableDef = require('./lib/table-def')
const Indexer = require('./lib/indexer')
const WebDBTable = require('./lib/table')
const flatten = require('lodash.flatten')

class WebDBDB extends EventEmitter {
  constructor (name, opts = {}) {
    super()
    if (typeof window === 'undefined' && !opts.DatArchive) {
      throw new Error('Must provide {DatArchive} opt when using WebDBDB outside the browser.')
    }
    this.level = false
    this.name = name
    this.isBeingOpened = false
    this.isOpen = false
    this.DatArchive = opts.DatArchive || window.DatArchive
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
      this.level = sublevel(level(this.name, {valueEncoding: 'json'}))
      levelPromisify(this.level)
      this._indexMetaLevel = this.level.sublevel('_indexMeta')

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
          let tableMeta = await this.level.get('table:' + tableName)
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
      await Indexer.loadArchives(this, neededRebuilds.length > 0)

      // save checksums
      for (let i = 0; i < tableNames.length; i++) {
        let tableName = tableNames[i]
        let tableChecksum = this._tableDefs[tableName].checksum
        await this.level.put('table:' + tableName, {checksum: tableChecksum})
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
    debug('closing')
    this.isOpen = false
    if (this.level) {
      // Schemas.removeTables(this) TODO
      this.listSources().forEach(url => Indexer.unwatchArchive(this, this._archives[url]))
      await new Promise(resolve => this.level.close(resolve))
      this.level = null
      veryDebug('db .level closed')
    } else {
      veryDebug('db .level didnt yet exist')
    }
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

  async addSource (archive) {
    // handle array case
    if (Array.isArray(archive)) {
      return Promise.all(archive.map(a => this.addSource(a)))
    }

    // create our own new DatArchive instance
    archive = typeof archive === 'string' ? new (this.DatArchive)(archive) : archive
    if (!(archive.url in this._archives)) {
      // store and process
      debug('WebDB.addSource', archive.url)
      this._archives[archive.url] = archive
      await Indexer.addArchive(this, archive)
    }
  }

  async removeSource (archive) {
    archive = typeof archive === 'string' ? new (this.DatArchive)(archive) : archive
    if (archive.url in this._archives) {
      debug('WebDB.removeSource', archive.url)
      delete this._archives[archive.url]
      await Indexer.removeArchive(this, archive)
    }
  }

  listSources () {
    return Object.keys(this._archives)
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
module.exports = WebDBDB

