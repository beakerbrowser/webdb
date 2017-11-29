const Ajv = require('ajv')
const {assert} = require('./util')
const {SchemaError} = require('./errors')

const ajv = new Ajv()

exports.validateAndSanitize = function (definition) {
  // validate and sanitize
  assert(definition && typeof definition === 'object', SchemaError, `Must pass a definition object to db.define(), got ${definition}`)
  definition.index = arrayify(definition.index)
  assert(isIndexSpec(definition.index), SchemaError, `The .index field must be a valid index definition`)
  definition.index = definition.index.map(toIndexSpecObject)
  assert(allIndexSpecMultiDefsMatch(definition.index), SchemaError, `The .index field has a multi-defined index which doesnt match (eg def: ["foo", "foo+bar"]). Each definition must be equivalent.`)

  // compile the validator
  definition.validator = (definition.schema) ? ajv.compile(definition.schema) : null

  // always include origin
  if (!definition.index.find(v => v.name === ':origin')) {
    definition.index.push({name: ':origin', def: ':origin'})
  }
}

// helpers
// =


function arrayify (v) {
  if (typeof v === 'undefined') return []
  return Array.isArray(v) ? v : [v]
}

function isIndexSpec (v) {
  return v.reduce((acc, v) => acc && (
    typeof v === 'string' || (
      v && typeof v === 'object' &&
      typeof v.name === 'string' &&
      v.def != false
    )
  ), true)
}

function allIndexSpecMultiDefsMatch (v) {
  return v.reduce((acc, v) => {
    if (!acc) return false
    if (!Array.isArray(v.def)) return true
    let isMultiEntries = v.def.map(str => str.startsWith('*'))
    let compoundCounts = v.def.map(str => str.split('+').length)
    return allMatches(isMultiEntries) && allMatches(compoundCounts)
  }, true)
}

function allMatches (arr) {
  var lastValue = arr[0]
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== lastValue) return false
  }
  return true
}

function toIndexSpecObject (v) {
  if (typeof v === 'string') {
    return {name: v, def: v}
  }
  return v
}
