const {assert, eventHandler, errorHandler} = require('./util')

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
