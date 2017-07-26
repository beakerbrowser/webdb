/* globals window process console */

// read log level from the environment
const LOG_LEVEL = +(typeof window !== 'undefined' ? window.localStorage.LOG_LEVEL : process.env.LOG_LEVEL) || 0
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

// helper to handle events within a promise
// - pass the normal handler
// - and pass the reject method from the parent promise
exports.eventHandler = function (handler, reject) {
  return async e => {
    try {
      await handler(e)
    } catch (e) {
      reject(e)
    }
  }
}

// helper to handle events within a promise
// - if the event fires, rejects
exports.errorHandler = function (reject) {
  return e => {
    e.preventDefault()
    reject(e.target.error)
  }
}

// helper to rebroadcast an event
exports.eventRebroadcaster = function (emitter, name) {
  return e => {
    emitter.emit(name, e)
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
