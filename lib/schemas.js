const IngestTable = require('./table')
const LevelUtil = require('./util-level')
const {diffArrays, assert, debug, veryDebug, deepClone} = require('./util')
const {SchemaError} = require('./errors')

exports.validateAndSanitize = function (schema) {
  // validate and sanitize
  assert(schema && typeof schema === 'object', SchemaError, `Must pass a schema object to db.schema(), got ${schema}`)
  assert(schema.version > 0 && typeof schema.version === 'number', SchemaError, `The .version field is required and must be a number, got ${schema.version}`)
  getTableNames(schema).forEach(tableName => {
    var table = schema[tableName]
    if (table === null) {
      return // done, this is a deleted table
    }
    assert(!('singular' in table) || typeof table.singular === 'boolean', SchemaError, `The .singular field must be a bool, got ${table.singular}`)
    table.index = arrayify(table.index)
    assert(isIndexSpec(table.index), SchemaError, `The .index field must be a valid index definition`)
    table.index = table.index.map(toIndexSpecObject)
    assert(allIndexSpecMultiDefsMatch(table.index), SchemaError, `The .index field has a multi-defined index which doesnt match (eg def: ["foo", "foo+bar"]). Each definition must be equivalent.`)

    // always include origin
    if (!table.index.find(v => v.name === 'origin')) {
      table.index.push({name: 'origin', def: 'origin'})
    }
  })
}

// returns {add:[], change: [], remove: [], tablesToRebuild: []}
// - `add` is an array of [name, tableDef]s
// - `change` is an array of [name, tableChanges]s
// - `remove` is an array of names
// - `tablesToRebuild` is an array of names- tables that will need to be cleared and re-ingested
// - applied using `applyDiff()`, below
exports.diff = function (oldSchema, newSchema) {
  if (!oldSchema) {
    debug(`Schemas.diff creating diff for first version`)
  } else {
    debug(`Schemas.diff diffing ${oldSchema.version} against ${newSchema.version}`)
  }
  veryDebug('diff old', oldSchema)
  veryDebug('diff new', newSchema)
  // compare tables in both schemas
  // and produce a set of changes which will modify the db
  // to match `newSchema`
  var diff = {add: [], change: [], remove: [], tablesToRebuild: []}
  var allTableNames = new Set(getTableNames(oldSchema).concat(getTableNames(newSchema)))
  for (let tableName of allTableNames) {
    var oldSchemaHasTable = oldSchema ? (tableName in oldSchema) : false
    var newSchemaHasTable = (newSchema[tableName] !== null)
    if (oldSchemaHasTable && !newSchemaHasTable) {
      // remove
      diff.remove.push(tableName)
    } else if (!oldSchemaHasTable && newSchemaHasTable) {
      // add
      diff.add.push([tableName, newSchema[tableName]])
      diff.tablesToRebuild.push(tableName)
    } else if (newSchema[tableName]) {
      // different?
      var tableChanges = diffTables(oldSchema[tableName], newSchema[tableName])
      veryDebug('Schemas.diff diffTables', tableName, tableChanges)
      if (tableChanges.indexDiff) {
        diff.change.push([tableName, tableChanges])
      }
      if (tableChanges.needsRebuild) {
        diff.tablesToRebuild.push(tableName)
      }
    }
  }
  veryDebug('diff result, add', diff.add, 'change', diff.change, 'remove', diff.remove, 'rebuilds', diff.tablesToRebuild)
  return diff
}

// takes the return value of .diff()
// updates `db`
exports.applyDiff = async function (db, diff) {
  debug('Schemas.applyDiff')
  veryDebug('diff', diff)
  await Promise.all(diff.remove.map(tableName => {
    // deleted tables
    return LevelUtil.clear(db.level.sublevel(tableName))
  }))
  // NOTE
  // only need to delete old tables
  // everything else is a rebuild
  // -prf
}

// add builtin table defs to the db object
exports.addBuiltinTableSchemas = function (db) {
  // metadata on each indexed record
  db._schemas[0]._indexMeta = {index: []}
}

// add table defs to the db object
exports.addTables = function (db) {
  const tableNames = getActiveTableNames(db)
  debug('Schemas.addTables', tableNames)
  db._activeTableNames = tableNames
  tableNames.forEach(tableName => {
    db[tableName] = new IngestTable(db, tableName, db._activeSchema[tableName])
    db._tablePathPatterns.push(db[tableName]._pathPattern)
  })
}

// remove table defs from the db object
exports.removeTables = function (db) {
  const tableNames = getActiveTableNames(db)
  debug('Schemas.removeTables', tableNames)
  tableNames.forEach(tableName => {
    delete db[tableName]
  })
}

// helper to compute the current schema
exports.merge = function (currentSchema, newSchema) {
  var result = currentSchema ? deepClone(currentSchema) : {}
  // apply updates
  for (let k in newSchema) {
    if (newSchema[k] === null) {
      delete result[k]
    } else if (typeof newSchema[k] === 'object' && !Array.isArray(newSchema[k])) {
      result[k] = exports.merge(currentSchema[k], newSchema[k])
    } else {
      result[k] = newSchema[k]
    }
  }
  return result
}

// helpers
// =

function diffTables (oldTableDef, newTableDef) {
  const indexDiff = newTableDef.index ? diffArrays(oldTableDef.index, newTableDef.index) : false
  return {
    indexDiff,
    needsRebuild: !!indexDiff ||
      (oldTableDef.primaryKey !== newTableDef.primaryKey) ||
      (oldTableDef.singular !== newTableDef.singular)
  }
}

function getTableNames (schema, fn) {
  if (!schema) {
    return []
  }
  // all keys except 'version'
  return Object.keys(schema).filter(k => k !== 'version')
}

function getActiveTableNames (db) {
  var tableNames = new Set()
  db._schemas.forEach(schema => {
    getTableNames(schema).forEach(tableName => {
      if (schema[tableName] === null) {
        tableNames.delete(tableName)
      } else {
        tableNames.add(tableName)
      }
    })
  })
  return Array.from(tableNames)
}

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
