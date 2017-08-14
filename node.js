const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

global.window = {
  localStorage: {
    LOG_LEVEL: process.env.LOG_LEVEL
  },
  DatArchive
}

module.exports = require('./index')