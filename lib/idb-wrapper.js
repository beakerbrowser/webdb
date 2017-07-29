const IDBKeyRange = typeof window === 'undefined' ? require('fake-indexeddb/lib/FDBKeyRange') : window.IDBKeyRange
const {assert, eventHandler, errorHandler, debug, veryDebug} = require('./util')

// exported api
// =

exports.get = async function (table, key) {
  assert(key && typeof key === 'string')
  return transact(table, store => store.get(key))
}

exports.put = async function (table, record) {
  assert(record && typeof record === 'object')
  return transact(table, store => store.put(record), 'readwrite')
}

exports.update = async function (table, key, updates) {
  assert(updates && typeof updates === 'object')
  var record = await exports.get(table, key)
  record = record || {}
  for (var k in updates) {
    record[k] = updates[k]
  }
  await exports.put(table, record)
}

exports.delete = async function (table, key) {
  assert(key && typeof key === 'string')
  return transact(table, store => store.delete(key), 'readwrite')
}

exports.iterate = async function (recordSet, fn) {
  return new Promise((resolve, reject) => {
    debug('IDB.iterate', recordSet._table.name)
    var tx = getTransaction(recordSet._table)
    var store = getStore(recordSet._table, tx)
    var request = createCursor(store, recordSet)
    veryDebug('iterating', recordSet)

    var resultIndex = 0
    var numEmitted = 0
    var {_offset, _limit} = recordSet
    _offset = _offset || 0
    _limit = _limit || false
    veryDebug('offset', _offset, 'limit', _limit)
    request.onsuccess = (e) => {
      var cursor = e.target.result
      if (cursor) {
        veryDebug('onsuccess', cursor.value)
        if (resultIndex >= _offset && applyFilters(recordSet, cursor.value)) {
          // iter call
          fn(cursor.value)
          numEmitted++
        }
        resultIndex++
        if (_limit && numEmitted >= _limit || applyUntil(recordSet, cursor.value)) {
          // hit limit/until, stop here
          cursor.advance(1e9) // let's assume there wont ever be a billion records
        } else {
          cursor.continue()
        }
      } else {
        // no result signals we're finished
        resolve()
      }
    }
    request.oncomplete = () => console.log('oncomplete')//eventHandler(e => resolve(), reject)
    request.onerror = errorHandler(reject)
  })
}

// internal methods
// =

async function transact (table, fn, type) {
  return new Promise((resolve, reject) => {
    var tx = getTransaction(table, type)
    var store = getStore(table, tx)
    var req = fn(store)
    tx.onerror = errorHandler(reject)
    tx.oncomplete = eventHandler(e => resolve(req.result), reject)
  })
}

function getTransaction (table, type) {
  return table.idb.transaction([table.name], type)
}

function getStore (table, tx) {
  return tx.objectStore(table.name)
}

function createCursor (store, recordSet) {
  const {_direction, _distinct, _where} = recordSet

  // use an index if reading from the non-primary key
  var cursorFactory = store
  if (_where && _where._index !== '_url') {
    veryDebug('setting cursor factory to index', _where._index)
    cursorFactory = store.index(_where._index)
  } else {
    veryDebug('using default cursor factory')
  }

  // build params and start read
  const keyRange = createKeyRange(_where)
  return cursorFactory.openCursor(keyRange, _direction + (_distinct ? 'unique' : ''))
}

function createKeyRange (whereClause) {
  if (!whereClause) return
  if (whereClause._only) {
    return IDBKeyRange.only(whereClause._only)
  }
  if (whereClause._lowerBound && whereClause._upperBound) {
    return IDBKeyRange.bound(
      whereClause._lowerBound,
      whereClause._upperBound,
      !whereClause._lowerBoundInclusive,
      !whereClause._upperBoundInclusive
    )
  }
  if (whereClause._lowerBound) {
    return IDBKeyRange.lowerBound(
      whereClause._lowerBound,
      !whereClause._lowerBoundInclusive
    )
  }
  if (whereClause._upperBound) {
    return IDBKeyRange.upperBound(
      whereClause._upperBound,
      !whereClause._upperBoundInclusive
    )
  }
}

function applyFilters (recordSet, value) {
  for (let i = 0; i < recordSet._filters.length; i++) {
    if (!recordSet._filters[i](value)) {
      return false
    }
  }
  return true
}

function applyUntil (recordSet, value) {
  return (recordSet._until && recordSet._until(value))
}
