const {assert} = require('./util')
const {ParameterError, QueryError} = require('./errors')
const MAX_STRING = String.fromCharCode(65535)

// exported api
// =

class InjestWhereClause {
  constructor (recordSet, index) {
    this._recordSet = recordSet
    this._index = index
    this._only = null
    this._lowerBound = null
    this._lowerBoundInclusive = false
    this._upperBound = null
    this._upperBoundInclusive = false
  }

  // (lowerBound) => InjestRecordset
  above (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = false
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
    args.sort()
    var [lo, hi] = [args[0], args[args.length - 1]]
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .anyOf() must be strings or numbers')
    }
    return this.between(lo, hi, {includeLower: true, includeUpper: true})
      .filter(record => {
        var v = (record[this._index] || '').toString()
        return args.indexOf(v) !== -1
      })
  }

  // (Array|...args) => InjestRecordset
  anyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .anyOfIgnoreCase() must be strings or numbers')
    }
    return this._recordSet.filter(record => {
      var v = (record[this._index] || '').toString().toLowerCase()
      return args.indexOf(v) !== -1
    })
  }

  // (upperBound) => InjestRecordset
  below (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = false
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
    // just filter down to matches
    assert(typeof value !== 'object', QueryError, 'The parameter to .equalsIgnoreCase() must be a string or number')
    value = (value || '').toString().toLowerCase()
    return this._recordSet.filter(record => {
      var v = (record[this._index] || '').toString().toLowerCase()
      return v === value
    })
  }

  // (Array|...args) => InjestRecordset
  noneOf (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .noneOf() must be strings or numbers')
    }
    return this._recordSet.filter(record => {
      var v = (record[this._index] || '').toString()
      return args.indexOf(v) === -1
    })
  }

  // (value) => InjestRecordset
  notEqual (value) {
    // just filter down to matches
    return this._recordSet.filter(record => {
      return record[this._index] !== value
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
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOf() must be strings or numbers')
    }
    return this._recordSet.filter(record => {
      var value = (record[this._index] || '').toString()
      for (let i = 0; i < args.length; i++) {
        if (value.startsWith(args[i])) {
          return true
        }
      }
      return false
    })
  }

  // (Array|...args) => InjestRecordset
  startsWithAnyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOfIgnoreCase() must be strings or numbers')
    }
    return this._recordSet.filter(record => {
      var value = (record[this._index] || '').toString().toLowerCase()
      for (let i = 0; i < args.length; i++) {
        if (value.startsWith(args[i])) {
          return true
        }
      }
      return false
    })
  }

  // (value) => InjestRecordset
  startsWithIgnoreCase (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    value = value.toLowerCase()
    // just filter down to matches
    return this._recordSet.filter(record => {
      return (record[this._index] || '').toString().toLowerCase().startsWith(value)
    })
  }
}

module.exports = InjestWhereClause

// internal methods
// =

function toArrayOfStrings (arr, {toLowerCase} = {}) {
  return arr.map(v => {
    if (typeof v === 'object') {
      throw new Parameter()
    }
    v = v ? v.toString() : ''
    if (toLowerCase) v = v.toLowerCase()
    return v
  })
}
