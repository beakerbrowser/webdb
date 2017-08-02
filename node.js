const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

class NodeDatArchive extends DatArchive {
  constructor(url) {
    super(url, {localPath: tempy.directory()})
  }
}

global.window = {
  indexedDB: require('fake-indexeddb'),
  IDBKeyRange: require('fake-indexeddb/lib/FDBKeyRange'),
  localStorage: {
    LOG_LEVEL: process.env.LOG_LEVEL
  },
  DatArchive: NodeDatArchive
}

module.exports = require('./index')