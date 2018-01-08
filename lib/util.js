/* globals window process console URL */
const AwaitLock = require('await-lock')
const MD5 = require('md5.js')
const URL = (typeof window === 'undefined') ? require('url-parse') : window.URL
exports.URL = URL

// read log level from the environment
const LOG_LEVEL = (typeof window === 'undefined'
  ? +process.env.LOG_LEVEL
  : +window.localStorage.LOG_LEVEL) || 0
const LOG_LEVEL_DEBUG = 1
const LOG_LEVEL_VERYDEBUG = 2

// debug logging
function noop () {}
exports.debug = (LOG_LEVEL >= LOG_LEVEL_DEBUG) ? console.log : noop
exports.veryDebug = (LOG_LEVEL >= LOG_LEVEL_VERYDEBUG) ? console.log : noop

// assert helper
exports.assert = function (cond, ErrorConstructor = Error, msg) {
  if (!cond) {
    throw new ErrorConstructor(msg)
  }
}

// provide a diff of 2 arrays
// eg diffArrays([1,2], [2,3]) => {add: [3], remove: [1]}
// if no difference, returns false
exports.diffArrays = function (left, right) {
  var diff = {add: [], remove: []}

  // iterate all values in the arrays
  var union = new Set(left.concat(right))
  for (let index of union) {
    // push to add/remove based on left/right membership
    var leftHas = left.indexOf(index) !== -1
    var rightHas = right.indexOf(index) !== -1
    if (leftHas && !rightHas) {
      diff.remove.push(index)
    } else if (!leftHas && rightHas) {
      diff.add.push(index)
    }
  }

  if (diff.add.length === 0 && diff.remove.add === 0) {
    return false
  }
  return diff
}

exports.getObjectChecksum = function (object) {
  return new MD5().update(JSON.stringify(object, checksumStringify)).digest('hex')
}

// this helper includes functions in the JSON output used in getObjectChecksum
// that way the checksum changes if any function definitions change
function checksumStringify (k, v) {
  if (typeof v === 'function') return v.toString()
  return v
}

exports.deepClone = function (v) {
  return JSON.parse(JSON.stringify(v))
}

exports.toArchiveUrl = function (v) {
  if (v) {
    if (typeof v.url === 'string') {
      v = v.url
    }
    const urlp = new URL(v)
    return urlp.protocol + '//' + urlp.hostname
  }
  throw new Error('Not a valid archive')
}

// wraps await-lock in a simpler interface, with many possible locks
// usage:
/*
async function foo () {
  var release = await lock('bar')
  // ...
  release()
}
*/
var locks = {}
exports.lock = async function (key) {
  if (!(key in locks)) locks[key] = new AwaitLock()

  var lock = locks[key]
  await lock.acquireAsync()
  return lock.release.bind(lock)
}
