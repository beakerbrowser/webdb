const InjestDB = require('../')
const test = require('ava')
const {debug} = require('../lib/util')

var __counter = 0
function newDB () {
  var name = 'test' + (++__counter)
  debug('\n##', name, '\n')
  return new InjestDB(name)
}

test('simple v1: add table', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  await testDB.open()

  // check that the table was created correctly
  t.truthy(testDB.firstTable)
  var tx = testDB.idx.transaction('firstTable')
  var store = tx.objectStore('firstTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['a', 'b', 'c'])

  await testDB.close()
})

test('simple v2: add another table', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  testDB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  await testDB.open()

  // check that the table was created correctly
  t.truthy(testDB.firstTable)
  t.truthy(testDB.secondTable)
  var tx = testDB.idx.transaction('firstTable')
  var store = tx.objectStore('firstTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['a', 'b', 'c'])
  var tx = testDB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'e', 'f'])

  await testDB.close()
})

test('simple v3: delete the first table', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  testDB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  testDB.schema({
    version: 3,
    firstTable: null
  })
  await testDB.open()

  // check that the table was created correctly
  t.falsy(testDB.firstTable)
  t.truthy(testDB.secondTable)
  var tx = testDB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'e', 'f'])
  
  await testDB.close()
})

test('simple v4: modify the index', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  testDB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  testDB.schema({
    version: 3,
    firstTable: null
  })
  testDB.schema({
    version: 4,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'f', 'g']
    }
  })
  await testDB.open()

  // check that the table was created correctly
  t.falsy(testDB.firstTable)
  t.truthy(testDB.secondTable)
  var tx = testDB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'f', 'g'])

  await testDB.close()
})

test('simple v5: add another table', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  testDB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  testDB.schema({
    version: 3,
    firstTable: null
  })
  testDB.schema({
    version: 4,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'f', 'g']
    }
  })
  testDB.schema({
    version: 5,
    thirdTable: {
      path: '/table3/*.json',
      buildPath: record => `/table3/${record.id}.json`,
    }
  })
  await testDB.open()

  // check that the table was created correctly
  t.falsy(testDB.firstTable)
  t.truthy(testDB.secondTable)
  t.truthy(testDB.thirdTable)
  var tx = testDB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['d', 'f', 'g'])
  var tx = testDB.idx.transaction('thirdTable')
  var store = tx.objectStore('thirdTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, [])

  await testDB.close()
})

test('simple v6: add / change / remove all at once', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a', 'b', 'c']
    }
  })
  testDB.schema({
    version: 2,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'e', 'f']
    }
  })
  testDB.schema({
    version: 3,
    firstTable: null
  })
  testDB.schema({
    version: 4,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: ['d', 'f', 'g']
    }
  })
  testDB.schema({
    version: 5,
    thirdTable: {
      path: '/table3/*.json',
      buildPath: record => `/table3/${record.id}.json`,
    }
  })
  testDB.schema({
    version: 6,
    secondTable: {
      path: '/table2/*.json',
      buildPath: record => `/table2/${record.id}.json`,
      index: 'z'
    },
    thirdTable: null,
    fourthTable: {
      path: '/table4/*.json',
      buildPath: record => `/table4/${record.id}.json`,
    }
  })
  await testDB.open()

  // check that the table was created correctly
  t.falsy(testDB.firstTable)
  t.truthy(testDB.secondTable)
  t.falsy(testDB.thirdTable)
  t.truthy(testDB.fourthTable)
  var tx = testDB.idx.transaction('secondTable')
  var store = tx.objectStore('secondTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, ['z'])
  var tx = testDB.idx.transaction('fourthTable')
  var store = tx.objectStore('fourthTable')
  t.truthy(store)
  t.deepEqual(store.indexNames, [])

  await testDB.close()
})
