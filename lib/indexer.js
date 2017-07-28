const flatten = require('lodash.flatten')
const anymatch = require('anymatch')
const IDB = require('./idb-wrapper')
const {debug, veryDebug, lock} = require('./util')

// exported api
// =

exports.processArchive = async function (db, archive) {
  veryDebug('processing', archive.url)
  return indexArchive(db, archive)
}

exports.disposeArchive = async function (db, archive) {
  veryDebug('disposing', archive.url)
  return unindexArchive(db, archive)
}

exports.watchArchive = function (db, archive) {
  veryDebug('watching', archive.url)
  if (archive.fileEvents) {
    debug('watchArchive() called on archive that already is being watched', archive)
    return
  }
  archive.fileEvents = archive.createFileActivityStream(db.tablePathPatterns)
  // autodownload all changes to the watched files
  archive.fileEvents.addEventListener('invalidated', ({path}) => archive.download(path))
  // autoindex on changes
  // TODO debounce!!!!
  archive.fileEvents.addEventListener('changed', ({path}) => indexArchive(db, archive))
}

exports.unwatchArchive = function (db, archive) {
  veryDebug('unwatching', archive.url)
  if (archive.fileEvents) {
    archive.fileEvents.close()
    archive.fileEvents = null
  }
}

// internal methods
// =

// figure how what changes need to be processed
// then update the indexes
async function indexArchive (db, archive) {
  var release = await lock(`index:${archive.url}`)
  try {
    // fetch the current state of the archive's index
    var [indexMeta, archiveMeta] = await Promise.all([
      IDB.get(db._indexMeta, archive.url),
      archive.getInfo()
    ])
    indexMeta = indexMeta || {version: 0}

    // has this version of the archive been processed?
    if (indexMeta && indexMeta.version >= archiveMeta.version) {
      debug('aborting index for', archive.url, 'no updates found')
      return // yes, stop
    }
    debug('indexing', archive.url, 'start', indexMeta.version, 'end', archiveMeta.version)

    // find and apply all changes which haven't yet been processed
    var updates = await scanArchiveHistoryForUpdates(db, archive, {
      start: indexMeta.version,
      end: archiveMeta.version + 1
    })
    var results = await applyUpdates(db, archive, updates)
    debug('applied', results.length, 'updates from', archive.url)

    // update meta
    await IDB.update(db._indexMeta, archive.url, {
      _url: archive.url,
      version: archiveMeta.version // record the version we've indexed
    })
  } finally {
    release()
  }
}

// delete all records generated from the archive
async function unindexArchive (db, archive) {
  var release = await lock(`index:${archive.url}`)
  try {
    // find any relevant records and delete them from the indexes
    var recordMatches = await scanArchiveForRecords(db, archive)
    await Promise.all(recordMatches.map(match => IDB.delete(match.table, match.recordUrl)))
    await IDB.delete(db._indexMeta, archive.url)
  } finally {
    release()
  }
}

// look through the given history slice
// match against the tables' path patterns
// return back the *latest* change to each matching changed record
async function scanArchiveHistoryForUpdates (db, archive, {start, end}) {
  var history = await archive.history({start, end})
  var updates = {}
  history.forEach(update => {
    if (anymatch(db._tablePathPatterns, update.path)) {
      updates[update.path] = update
    }
  })
  return updates
}

// look through the archive for any files that generate records
async function scanArchiveForRecords (db, archive) {
  var recordFiles = await Promise.all(db.tables.map(table => {
    return table.listRecordFiles(archive)
  }))
  return flatten(recordFiles)
}

// iterate the updates and apply them to the indexes
async function applyUpdates (db, archive, updates) {
  return Promise.all(Object.keys(updates).map(async path => {
    var update = updates[path]
    if (update.type === 'del') {
      return unindexFile(db, archive, update.path)
    } else {
      return readAndIndexFile(db, archive, update.path)
    }
  }))
}

// read the file, find the matching table, validate, then store
async function readAndIndexFile (db, archive, filepath) {
  const tables = db.tables
  const fileUrl = archive.url + filepath
  try {
    // read file
    var record = JSON.parse(await archive.readFile(filepath))

    // index on the first matching table
    for (var i = 0; i < tables.length; i++) {
      let table = tables[i]
      if (table.isRecordFile(filepath)) {
        // validate if needed
        if (table.schema.validator) {
          record = table.schema.validator(record)
        }
        // add standard attributes
        record._url = fileUrl
        record._origin = archive.url
        // save
        await IDB.put(table, record)
        return true
      }
    }
  } catch (e) {
    console.log('Failed to index', fileUrl, e)
  }
  return false
}

async function unindexFile (db, archive, filepath) {
  const tables = db.tables
  const fileUrl = archive.url + filepath
  try {
    // unindex on the first matching table
    for (var i = 0; i < tables.length; i++) {
      let table = tables[i]
      if (table.isRecordFile(filepath)) {
        await IDB.delete(table, fileUrl)
        return true
      }
    }
  } catch (e) {
    console.log('Failed to unindex', fileUrl, e)
  }
  return false
}
