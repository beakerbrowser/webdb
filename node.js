const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

class NodeDatArchive extends DatArchive {
  constructor(url) {
    super(url, {localPath: tempy.directory()})
  }
}

global.window = {
  localStorage: {
    LOG_LEVEL: process.env.LOG_LEVEL
  },
  DatArchive: NodeDatArchive
}

module.exports = require('./index')