/* globals DatArchive */

const EventEmitter = require('events')
const level = require('level-browserify')
const sublevel = require('level-sublevel')
const levelPromisify = require('level-promise')
const {debug, veryDebug, assert} = require('./lib/util')
const {SchemaError} = require('./lib/errors')
const Schemas = require('./lib/schemas')
const Indexer = require('./lib/indexer')

class InjestDB extends EventEmitter {
  constructor (name) {
    super()
    this.level = false
    this.name = name
    this.version = 0
    this.isBeingOpened = false
    this.isOpen = false
    this._schemas = []
    this._archives = {}
    this._tablesToRebuild = []
    this._activeTableNames = []
    this._activeSchema = null
    this._tablePathPatterns = []
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
    this.isBeingOpened = true
    Schemas.addBuiltinTableSchemas(this)

    // open the db
    debug('opening')
    try {
      this.level = sublevel(level(this.name, {valueEncoding: 'json'}))
      levelPromisify(this.level)

      // run upgrades
      try {
        var oldVersion = (await this.level.get('version')) || 0
      } catch (e) {
        oldVersion = 0
      }
      if (oldVersion < this.version) {
        await runUpgrades({db: this, oldVersion})
        await this.level.put('version', this.version)
      }

      // construct the final injestdb object
      this._activeSchema = this._schemas.reduce(Schemas.merge, {})
      this.isBeingOpened = false
      this.isOpen = true
      Schemas.addTables(this)
      let needsRebuild = await Indexer.resetOutdatedIndexes(this)
      await Indexer.loadArchives(this, needsRebuild)

      // events
      debug('opened')
      this.emit('open')
    } catch (e) {
      console.error('Upgrade has failed', e)
      this.isBeingOpened = false
      this.emit('open-failed', e)
    }
  }

  async close () {
    debug('closing')
    this.isOpen = false
    if (this.level) {
      Schemas.removeTables(this)
      this.listArchives().forEach(archive => Indexer.unwatchArchive(this, archive))
      await new Promise(resolve => this.level.close(resolve))
      this.level = null
      veryDebug('db .level closed')
    } else {
      veryDebug('db .level didnt yet exist')
    }
  }

  schema (desc) {
    assert(!this.level && !this.isBeingOpened, SchemaError, 'Cannot add version when database is open')
    Schemas.validateAndSanitize(desc)

    // update current version
    this.version = Math.max(this.version, desc.version)
    this._schemas.push(desc)
    this._schemas.sort(lowestVersionFirst)
  }

  get tables () {
    return this._activeTableNames
      .filter(name => !name.startsWith('_'))
      .map(name => this[name])
  }

  async prepareArchive (archive) {
    archive = typeof archive === 'string' ? new DatArchive(archive) : archive
    await Promise.all(this.tables.map(table => {
      if (!table.schema.singular) {
        return archive.mkdir(`/${table.name}`).catch(() => {})
      }
    }))
  }

  async addArchive (archive, {prepare} = {}) {
    // create our own new DatArchive instance
    archive = typeof archive === 'string' ? new DatArchive(archive) : archive
    if (!(archive.url in this._archives)) {
      // store and process
      debug('Injest.addArchive', archive.url)
      this._archives[archive.url] = archive
      if (prepare !== false) await this.prepareArchive(archive)
      await Indexer.addArchive(this, archive)
    }
  }

  async addArchives (archives, opts) {
    archives = Array.isArray(archives) ? archives : [archives]
    return Promise.all(archives.map(a => this.addArchive(a, opts)))
  }

  async removeArchive (archive) {
    archive = typeof archive === 'string' ? new DatArchive(archive) : archive
    if (archive.url in this._archives) {
      debug('Injest.removeArchive', archive.url)
      delete this._archives[archive.url]
      await Indexer.removeArchive(this, archive)
    }
  }

  listArchives (archive) {
    return Object.keys(this._archives).map(url => this._archives[url])
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
module.exports = InjestDB

// run the database's queued upgrades
async function runUpgrades ({db, oldVersion}) {
  // get the ones that haven't been run
  var upgrades = db._schemas.filter(s => s.version > oldVersion)
  db._activeSchema = db._schemas.filter(s => s.version <= oldVersion).reduce(Schemas.merge, {})
  if (oldVersion > 0 && !db._activeSchema) {
    throw new SchemaError(`Missing schema for previous version (${oldVersion}), unable to run upgrade.`)
  }
  debug(`running upgrade from ${oldVersion}, ${upgrades.length} upgrade(s) found`)

  // diff and apply changes
  var tablesToRebuild = []
  for (let schema of upgrades) {
    // compute diff
    debug(`applying upgrade for version ${schema.version}`)
    var diff = Schemas.diff(db._activeSchema, schema)

    // apply diff
    await Schemas.applyDiff(db, diff)
    tablesToRebuild.push(diff.tablesToRebuild)

    // update current schema
    db._activeSchema = Schemas.merge(db._activeSchema, schema)
    debug(`version ${schema.version} applied`)
  }

  // track the tables that need rebuilding
  db._tablesToRebuild = Array.from(new Set(...tablesToRebuild))
  debug('Injest.runUpgrades complete', (db._tablesToRebuild.length === 0) ? '- no rebuilds needed' : 'REBUILD REQUIRED')
}

function lowestVersionFirst (a, b) {
  return a.version - b.version
}

