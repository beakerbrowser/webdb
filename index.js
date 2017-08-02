/* globals window DatArchive */

const EventEmitter = require('events')
const {debug, veryDebug, assert, eventHandler, errorHandler, eventRebroadcaster} = require('./lib/util')
const {DatabaseClosedError, SchemaError} = require('./lib/errors')
const Schemas = require('./lib/schemas')
const Indexer = require('./lib/indexer')
const InjestTable = require('./lib/table')
const indexedDB = window.indexedDB

class InjestDB extends EventEmitter {
  constructor (name) {
    super()
    this.idx = false
    this.name = name
    this.version = 0
    this.isBeingOpened = false
    this.isOpen = false
    this.isClosed = false
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

    // Default subscribers to 'versionchange' and 'blocked'.
    // Can be overridden by custom handlers. If custom handlers return false, these default
    // behaviours will be prevented.
    this.on('versionchange', e => {
      // Default behavior for versionchange event is to close database connection.
      // Caller can override this behavior by doing this.on('versionchange', function(){ return false; });
      // Let's not block the other window from making it's delete() or open() call.
      // NOTE! This event is never fired in IE,Edge or Safari.
      if (e.newVersion > 0) {
        console.warn(`Another connection wants to upgrade database '${this.name}'. Closing db now to resume the upgrade.`)
      } else {
        console.warn(`Another connection wants to delete database '${this.name}'. Closing db now to resume the delete request.`)
      }
      this.close()
      // In many web applications, it would be recommended to force window.reload()
      // when this event occurs. To do that, subscribe to the versionchange event
      // and call window.location.reload(true) if e.newVersion > 0 (not a deletion)
      // The reason for this is that your current web app obviously has old schema code that needs
      // to be updated. Another window got a newer version of the app and needs to upgrade DB but
      // your window is blocking it unless we close it here.
    })
    this.on('blocked', e => {
      if (!e.newVersion || e.newVersion < e.oldVersion) {
        console.warn(`InjestDB.delete('${this.name}') was blocked`)
      } else {
        console.warn(`Upgrade '${this.name}' blocked by other connection holding version ${e.oldVersion}`)
      }
    })
  }

  async open () {
    // guard against duplicate opens
    if (this.isBeingOpened || this.idx) {
      veryDebug('duplicate open, returning ready promise')
      return this._dbReadyPromise
    }
    if (this.isOpen) {
      return
    }
    // if (this.isClosed) {
    //   veryDebug('open after close')
    //   throw new DatabaseClosedError()
    // }
    this.isBeingOpened = true
    Schemas.addBuiltinTableSchemas(this)

    debug('opening')

    var upgradeTransaction
    try {
      // start the opendb request
      await new Promise((resolve, reject) => {
        var req = indexedDB.open(this.name, this.version)
        req.onerror = errorHandler(reject)
        req.onblocked = eventRebroadcaster(this, 'blocked')

        // run the upgrades
        req.onupgradeneeded = eventHandler(async e => {
          debug('upgrade needed', {oldVersion: e.oldVersion, newVersion: e.newVersion})
          upgradeTransaction = req.transaction
          upgradeTransaction.onerror = errorHandler(reject) // if upgrade fails, open() fails
          await runUpgrades({db: this, oldVersion: e.oldVersion, upgradeTransaction})
        }, reject)

        // open suceeded
        req.onsuccess = eventHandler(async () => {
          // construct the final injestdb object
          this._activeSchema = this._schemas.reduce(Schemas.merge, {})
          this.isBeingOpened = false
          this.isOpen = true
          this.idx = req.result
          Schemas.addTables(this)
          var needsRebuild = await Indexer.resetOutdatedIndexes(this)
          await Indexer.loadArchives(this, needsRebuild)

          // events
          debug('opened')
          this.idx.onversionchange = eventRebroadcaster(this, 'versionchange')
          this.emit('open')
          resolve()
        }, reject)
      })
    } catch (e) {
      // Did we fail within onupgradeneeded? Make sure to abort the upgrade transaction so it doesnt commit.
      console.error('Upgrade has failed', e)
      if (upgradeTransaction) {
        upgradeTransaction.abort()
      }
      this.isBeingOpened = false
      this.emit('open-failed', e)
    }
  }

  close () {
    debug('closing')
    if (this.idx) {
      Schemas.removeTables(this)
      this.listArchives().forEach(archive => Indexer.unwatchArchive(this, archive))
      this.idx.close()
      this.idx = null
      veryDebug('db .idx closed')
    } else {
      veryDebug('db .idx didnt yet exist')
    }
    this.isOpen = false
    this.isClosed = true
  }

  schema (desc) {
    assert(!this.idx && !this.isBeingOpened, SchemaError, 'Cannot add version when database is open')
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
      if (prepare) await this.prepareArchive(archive)
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
    // delete the database from indexeddb
    return new Promise((resolve, reject) => {
      var req = indexedDB.deleteDatabase(name)
      req.onsuccess = resolve
      req.onerror = errorHandler(reject)
      req.onblocked = eventRebroadcaster(this, 'blocked')
    })
  }
}
module.exports = InjestDB

// run the database's queued upgrades
async function runUpgrades ({db, oldVersion, upgradeTransaction}) {
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
    await Schemas.applyDiff(db, upgradeTransaction, diff)
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

