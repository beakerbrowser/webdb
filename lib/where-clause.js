const {assert} = require('./util')
const {ParameterError, QueryError} = require('./errors')
const MAX_STRING = String.fromCharCode(65535)

// exported api
// =

class WebDBWhereClause {
  constructor (query, index) {
    this.query = query
    this._index = index
    this._only = undefined
    this._lowerBound = undefined
    this._lowerBoundInclusive = false
    this._upperBound = undefined
    this._upperBoundInclusive = false
  }

  // (lowerBound) => WebDBQuery
  above (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = false
    return this.query
  }

  // (lowerBound) => WebDBQuery
  aboveOrEqual (lowerBound) {
    this._lowerBound = lowerBound
    this._lowerBoundInclusive = true
    return this.query
  }

  // (Array|...args) => WebDBQuery
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
        return testValues(this, record, v => {
          v = (v || '').toString()
          return args.indexOf(v) !== -1
        })
      })
  }

  // (Array|...args) => WebDBQuery
  anyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .anyOfIgnoreCase() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(this, record, v => {
        v = (v || '').toString().toLowerCase()
        return args.indexOf(v) !== -1
      })
    })
  }

  // (upperBound) => WebDBQuery
  below (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = false
    return this.query
  }

  // (upperBound) => WebDBQuery
  belowOrEqual (upperBound) {
    this._upperBound = upperBound
    this._upperBoundInclusive = true
    return this.query
  }

  // (lowerBound, upperBound, opts) => WebDBQuery
  between (lowerBound, upperBound, {includeLower, includeUpper} = {}) {
    this._lowerBound = lowerBound
    this._upperBound = upperBound
    this._lowerBoundInclusive = !!includeLower
    this._upperBoundInclusive = !!includeUpper
    return this.query
  }

  // (value) => WebDBQuery
  equals (value) {
    this._only = value
    return this.query
  }

  // (value) => WebDBQuery
  equalsIgnoreCase (value) {
    // just filter down to matches
    assert(typeof value !== 'object', QueryError, 'The parameter to .equalsIgnoreCase() must be a string or number')
    value = (value || '').toString().toLowerCase()
    return this.query.filter(record => {
      return testValues(this, record, v => {
        v = (v || '').toString().toLowerCase()
        return v === value
      })
    })
  }

  // (Array|...args) => WebDBQuery
  noneOf (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .noneOf() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(this, record, v => {
        v = (v || '').toString()
        return args.indexOf(v) === -1
      })
    })
  }

  // (value) => WebDBQuery
  notEqual (value) {
    // just filter down to matches
    return this.query.filter(record => {
      return testValues(this, record, v => {
        return v !== value
      })
    })
  }

  // (value) => WebDBQuery
  startsWith (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    return this.between(value, value + MAX_STRING)
  }

  // (Array|...args) => WebDBQuery
  startsWithAnyOf (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args)
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOf() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(this, record, v => {
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

  // (Array|...args) => WebDBQuery
  startsWithAnyOfIgnoreCase (...args) {
    // just filter down to matches
    try {
      args = toArrayOfStrings(args, {toLowerCase: true})
    } catch (e) {
      throw new QueryError('The parameters to .startsWithAnyOfIgnoreCase() must be strings or numbers')
    }
    return this.query.filter(record => {
      return testValues(this, record, v => {
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

  // (value) => WebDBQuery
  startsWithIgnoreCase (value) {
    assert(typeof value === 'string', ParameterError, `First parameter or .startsWith() must be a string, got ${value}`)
    value = value.toLowerCase()
    // just filter down to matches
    return this.query.filter(record => {
      return testValues(this, record, v => {
        return (v || '').toString().toLowerCase().startsWith(value)
      })
    })
  }
}

module.exports = WebDBWhereClause

// internal methods
// =

function testValues (where, record, fn) {
  // get the value
  var v
  var keyPaths = where.query._table.level.indexes[where._index].keyPaths
  for (let i = 0; i < keyPaths.length; i++) {
    if (typeof v !== 'undefined') break
    v = lookupRecordValue(record, keyPaths[i][0])
  }
  if (typeof v === 'undefined') return false

  // run the test
  if (Array.isArray(v)) {
    return v.reduce((agg, v) => agg || fn(v), false)
  }
  return fn(v)
}

function lookupRecordValue (record, key) {
  if (key === ':url') return record.getRecordURL()
  if (key === ':origin') return record.getRecordOrigin()
  if (key === ':indexedAt') return record.getIndexedAt()
  return record[key]
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
