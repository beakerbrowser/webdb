const {assert} = require('./util')
const {ParameterError, QueryError} = require('./errors')
const MAX_STRING = String.fromCharCode(65535)

// exported api
// =

class IngestWhereClause {
  constructor (query, index) {
    this.query = query
    this._index = index
    this._only = undefined
    this._lowerBound = undefined
    this._lowerBoundInclusive = false
    this._upperBound = undefined
    this._upperBoundInclusive = false
  }

  // (lowerBound) => IngestQuery
  above (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = false
    return this.query
  }

  // (lowerBound) => IngestQuery
  aboveOrEqual (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = true
    return this.query
  }

  // (Array|...args) => IngestQuery
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
        return testValues(record[this._index], v => {
          v = (v || '').toString()
          return args.indexOf(v) !== -1
        })
      })
  }

  // (Array|...args) => IngestQuery
  anyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .anyOfIgnoreCase() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        v = (v || '').toString().toLowerCase()
        return args.indexOf(v) !== -1
      })
    })
  }

  // (upperBound) => IngestQuery
  below (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = false
    return this.query
  }

  // (upperBound) => IngestQuery
  belowOrEqual (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = true
    return this.query
  }

  // (lowerBound, upperBound, opts) => IngestQuery
  between (lowerBound, upperBound, {includeLower, includeUpper} = {}) {
    this._lowerBound = lowerBound
    this._upperBound = upperBound
    this._lowerBoundInclusive = !!includeLower
    this._upperBoundInclusive = !!includeUpper
    return this.query
  }

  // (value) => IngestQuery
  equals (value) {
    this._only = value
    return this.query
  }

  // (value) => IngestQuery
  equalsIgnoreCase (value) {
    // just filter down to matches
    assert(typeof value !== 'object', QueryError, 'The parameter to .equalsIgnoreCase() must be a string or number')
    value = (value || '').toString().toLowerCase()
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        v = (v || '').toString().toLowerCase()
        return v === value
      })
    })
  }

  // (Array|...args) => IngestQuery
  noneOf (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .noneOf() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        v = (v || '').toString()
        return args.indexOf(v) === -1
      })
    })
  }

  // (value) => IngestQuery
  notEqual (value) {
    // just filter down to matches
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        return v !== value
      })
    })
  }

  // (value) => IngestQuery
  startsWith (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    return this.between(value, value + MAX_STRING)
  }

  // (Array|...args) => IngestQuery
  startsWithAnyOf (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOf() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        v = (v || '').toString()
        for (let i = 0; i < args.length; i++) {
          if (v.startsWith(args[i])) {
            return true
          }
        }
        return false
      })
    })
  }

  // (Array|...args) => IngestQuery
  startsWithAnyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOfIgnoreCase() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        v = (v || '').toString().toLowerCase()
        for (let i = 0; i < args.length; i++) {
          if (v.startsWith(args[i])) {
            return true
          }
        }
        return false
      })
    })
  }

  // (value) => IngestQuery
  startsWithIgnoreCase (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    value = value.toLowerCase()
    // just filter down to matches
    return this.query.filter(record => {
      return testValues(record[this._index], v => {
        return (v || '').toString().toLowerCase().startsWith(value)
      })
    })
  }
}

module.exports = IngestWhereClause

// internal methods
// =

function testValues (v, fn) {
  if (Array.isArray(v)) {
    return v.reduce((agg, v) => agg || fn(v), false)
  }
  return fn(v)
}

function toArrayOfStrings (arr, {toLowerCase} = {}) {
  return arr.map(v => {
    if (typeof v === 'object') {
      throw new ParameterError()
    }
    v = v ? v.toString() : ''
    if (toLowerCase) v = v.toLowerCase()
    return v
  })
}
