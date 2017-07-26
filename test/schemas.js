const InjestDB = require('../')
const test = require('ava')

const test1DB = new InjestDB('test1')

test('simple v1: add table', async t => {
  // setup the schema
  test1DB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  await test1DB.open()

  // check that the table was created correctly
  t.truthy(test1DB.firstTable)
  var tx = test1DB.idx.transaction('firstTable')
  var store = tx.objectStore('firstTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['a', 'b', 'c'])

  await test1DB.close()
})

test('simple v2: add another table', async t => {
  // setup the schema
  test1DB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  await test1DB.open()

  // check that the table was created correctly
  t.truthy(test1DB.firstTable)
  t.truthy(test1DB.secondTable)
  var tx = test1DB.idx.transaction('firstTable')
  var store = tx.objectStore('firstTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['a', 'b', 'c'])
  var tx = test1DB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'e', 'f'])

  await test1DB.close()
})

test('simple v3: delete the first table', async t => {
  // setup the schema
  test1DB.schema({
    version: 3,
    firstTable: null
  })
  await test1DB.open()

  // check that the table was created correctly
  t.falsy(test1DB.firstTable)
  t.truthy(test1DB.secondTable)
  var tx = test1DB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'e', 'f'])
  
  await test1DB.close()
})