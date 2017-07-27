/* globals window */

const EventEmitter = require('events')
const {debug, veryDebug, assert, eventHandler, errorHandler, eventRebroadcaster} = require('./lib/util')
const {DatabaseClosedError, SchemaError} = require('./lib/errors')
const Schemas = require('./lib/schemas')
const indexedDB = typeof window === 'undefined' ? require('fake-indexeddb') : window.indexedDB

class InjestDB extends EventEmitter {
  constructor (name) {
    super()
    this.idx = false
    this.name = name
    this.version = 0
    this.schemas = []
    this.dbReadyPromise = new Promise((resolve, reject) => {
      this.once('open', () => resolve(this))
      this.once('open-failed', reject)
    })
    this.isBeingOpened = false
    this.isOpen = false
    this.isClosed = false

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
      return this.dbReadyPromise
    }
    if (this.isOpen) {
      console.error('\n\nOH NO IS OPEN\n\n')
    }
    // if (this.isClosed) {
    //   veryDebug('open after close')
    //   throw new DatabaseClosedError()
    // }
    this.isBeingOpened = true

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
        req.onsuccess = eventHandler(() => {
          debug('opened')

          // construct the final injestdb object
          this.isBeingOpened = false
          this.isOpen = true
          this.idx = req.result
          Schemas.addTables(this)

          // events
          this.idx.onversionchange = eventRebroadcaster(this, 'versionchange')
          this.emit('open')
          resolve()
        }, reject)
      })
    } catch (e) {
      // Did we fail within onupgradeneeded? Make sure to abort the upgrade transaction so it doesnt commit.
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
    this.schemas.push(desc)
    this.schemas.sort(lowestVersionFirst)
  }

  get tables () {
    // TODO
    // return keys(allTables).map(function (name) { return allTables[name]; });
  }

  addOrigin (origin) {
    // TODO
  }

  removeOrigin (origin) {
    // TODO
  }

  listOrigins (origin) {
    // TODO
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
  var upgrades = db.schemas.filter(s => s.version > oldVersion)
  var currentSchema = db.schemas.filter(s => s.version <= oldVersion).reduce(Schemas.merge, {})
  if (oldVersion > 0 && !currentSchema) {
    throw new SchemaError(`Missing schema for previous version (${oldVersion}), unable to run upgrade.`)
  }
  debug(`running upgrade from ${oldVersion}, ${upgrades.length} upgrade(s) found`)

  // diff and apply changes
  var tablesToRebuild = []
  for (let schema of upgrades) {
    // compute diff
    debug(`applying upgrade for version ${schema.version}`)
    var diff = Schemas.diff(currentSchema, schema)
    veryDebug('diff', diff)

    // apply diff
    await Schemas.applyDiff(db, upgradeTransaction, diff)
    tablesToRebuild.push(diff.tablesToRebuild)

    // update current schema
    currentSchema = Schemas.merge(currentSchema, schema)
    debug(`version ${schema.version} applied`)
  }

  // rebuild as needed
  tablesToRebuild = new Set(...tablesToRebuild)
  if (tablesToRebuild.size > 0) {
    debug(`need to rebuid ${tablesToRebuild.size} tables`)
    veryDebug('tablesToRebuild', tablesToRebuild)
    // TODO
  }
  debug('finished running upgrades')
}

function lowestVersionFirst (a, b) {
  return a.version - b.version
}