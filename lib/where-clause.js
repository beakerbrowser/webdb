const {assert} = require('./util')
const {ParameterError} = require('./errors')
const MAX_STRING = String.fromCharCode(65535)

// exported api
// =

class InjestWhereClause {
  constructor (recordSet, indexOrQuery) {
    this._recordSet = recordSet
    this._index = indexOrQuery // TODO orQuery
    this._only = null
    this._lowerBound = null
    this._lowerBoundInclusive = false
    this._upperBound = null
    this._upperBoundInclusive = false
  }

  // (lowerBound) => InjestRecordset
  above (lowerBound) {
    this._lowerBound = lowerBound
    return this._recordSet
  }

  // (lowerBound) => InjestRecordset
  aboveOrEqual (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = true
    return this._recordSet
  }

  // (Array|...args) => InjestRecordset
  anyOf (...args) {
    // do a between() of the min and max values
    // then filter down to matches
    args = toArrayOfStrings(args)
    args.sort()
    return this.between(
      args[0],
      args[args.length - 1],
      {includeLower: true, includeUpper: true}
    ).filter(record => {
      return args.indexOf(record[this._index]) !== -1
    })
  }

  // (Array|...args) => InjestRecordset
  anyOfIgnoreCase (...args) {
    // do a between() of the min and max values
    // then filter down to matches
    args = toArrayOfStrings(args, {toLowerCase: true})
    args.sort()
    return this.between(
      args[0],
      args[args.length - 1],
      {includeLower: true, includeUpper: true}
    ).filter(record => {
      var v = record[this._index].toLowerCase()
      return args.indexOf(v) !== -1
    })
  }

  // (upperBound) => InjestRecordset
  below (upperBound) {
    this._upperBound = upperBound
    return this._recordSet
  }

  // (upperBound) => InjestRecordset
  belowOrEqual (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = true
    return this._recordSet
  }

  // (lowerBound, upperBound, opts) => InjestRecordset
  between (lowerBound, upperBound, {includeLower, includeUpper} = {}) {
    this._lowerBound = lowerBound
    this._upperBound = upperBound
    this._lowerBoundInclusive = !!includeLower
    this._upperBoundInclusive = !!includeUpper
    return this._recordSet
  }

  // (value) => InjestRecordset
  equals (value) {
    this._only = value
    return this._recordSet
  }

  // (value) => InjestRecordset
  equalsIgnoreCase (value) {
    return this.anyOfIgnoreCase([value])
  }

  // (Array|...args) => InjestRecordset
  noneOf (...args) {
    // just filter down to matches
    args = toArrayOfStrings(args)
    return this._recordSet.filter(record => {
      return args.indexOf(record[this._index]) === -1
    })
  }

  // (value) => InjestRecordset
  notEqual (value) {
    // just filter down to matches
    return this._recordSet.filter(record => {
      return record[this._index] === value
    })
  }

  // (value) => InjestRecordset
  startsWith (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    return this.between(value, value + MAX_STRING)
  }

  // (Array|...args) => InjestRecordset
  startsWithAnyOf (...args) {
    // just filter down to matches
    args = toArrayOfStrings(args)
    return this._recordSet.filter(record => {
      var value = (record[this._index] || '')
      for (let i = 0; i < args.length; i++) {
        if (value.startsWith(args[0])) {
          return true
        }
      }
      return false
    })
  }

  // (Array|...args) => InjestRecordset
  startsWithAnyOfIgnoreCase (...args) {
    // just filter down to matches
    args = toArrayOfStrings(args, {toLowerCase: true})
    return this._recordSet.filter(record => {
      var value = (record[this._index] || '').toLowerCase()
      for (let i = 0; i < args.length; i++) {
        if (value.startsWith(args[0])) {
          return true
        }
      }
      return false
    })
  }

  // (value) => InjestRecordset
  startsWithIgnoreCase (value) {
    // just filter down to matches
    return this._recordSet.filter(record => {
      return (record[this._index] || '').startsWith(value)
    })
  }
}

module.exports = InjestWhereClause

// internal methods
// =

function toArrayOfStrings (arr, {toLowerCase} = {}) {
  return arr.map(v => {
    v = v ? v.toString() : ''
    if (toLowerCase) v = v.toLowerCase()
    return v
  })
}
