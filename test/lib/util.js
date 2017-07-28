const InjestDB = require('../../')
const {debug} = require('../../lib/util')

var __counter = 0
exports.newDB = function () {
  const name = 'test' + (++__counter)
  debug('\n##', name, '\n')
  return new InjestDB(name)
}

var lastTs = 0
exports.ts = function () {
  var ts = Date.now()
  while (ts <= lastTs) {
    ts++ // cheat to avoid a collision
  }
  lastTs = ts
  return ts
}