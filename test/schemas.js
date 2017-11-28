const test = require('ava')
const {newDB, reopenDB} = require('./lib/util')

test.before(() => console.log('schemas.js'))

test('one table', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['a', 'b', 'c']
  })
  var res = await testDB.open()

  // check that the table was created correctly
  t.deepEqual(res, {rebuilds: ['firstTable']})
  t.truthy(testDB.firstTable)
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'b', 'c', 'origin'])

  await testDB.close()
})

test('two tables', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['a', 'b', 'c']
  })
  testDB.define('secondTable', {
    path: '/table2/*.json',
    buildPath: record => `/table2/${record.id}.json`,
    index: ['d', 'e', 'f']
  })
  var res = await testDB.open()

  // check that the table was created correctly
  t.deepEqual(res, {rebuilds: ['firstTable', 'secondTable']})
  t.truthy(testDB.firstTable)
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'b', 'c', 'origin'])
  t.truthy(testDB.secondTable)
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'e', 'f', 'origin'])

  await testDB.close()
})

test('properly detect changes', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['a', 'b', 'c']
  })
  testDB.define('secondTable', {
    path: '/table2/*.json',
    buildPath: record => `/table2/${record.id}.json`,
    index: ['d', 'e', 'f']
  })
  var res = await testDB.open()

  // check that the table was created correctly
  t.truthy(testDB.firstTable)
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'b', 'c', 'origin'])
  t.truthy(testDB.secondTable)
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'e', 'f', 'origin'])

  await testDB.close()
  const testDB2 = reopenDB(testDB)

  // change the firstTable schema
  testDB2.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['g', 'h', 'i']
  })
  testDB2.define('secondTable', {
    path: '/table2/*.json',
    buildPath: record => `/table2/${record.id}.json`,
    index: ['d', 'e', 'f']
  })
  res = await testDB2.open()

  // check that the table was created correctly
  t.deepEqual(res, {rebuilds: ['firstTable']})
  t.truthy(testDB2.firstTable)
  t.truthy(testDB2.firstTable.level)
  t.deepEqual(Object.keys(testDB2.firstTable.level.indexes), ['g', 'h', 'i', 'origin'])
  t.truthy(testDB2.secondTable)
  t.truthy(testDB2.secondTable.level)
  t.deepEqual(Object.keys(testDB2.secondTable.level.indexes), ['d', 'e', 'f', 'origin'])

  await testDB2.close()
  const testDB3 = reopenDB(testDB)

  // change the both schemas
  testDB3.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['g', 'h', 'i', 'j']
  })
  testDB3.define('secondTable', {
    path: '/table2/*.json',
    buildPath: record => `/table2/${record.id}.json`,
    index: ['d', 'e', 'f', 'g']
  })
  res = await testDB3.open()

  // check that the table was created correctly
  t.deepEqual(res, {rebuilds: ['firstTable', 'secondTable']})
  t.truthy(testDB3.firstTable)
  t.truthy(testDB3.firstTable.level)
  t.deepEqual(Object.keys(testDB3.firstTable.level.indexes), ['g', 'h', 'i', 'j', 'origin'])
  t.truthy(testDB3.secondTable)
  t.truthy(testDB3.secondTable.level)
  t.deepEqual(Object.keys(testDB3.secondTable.level.indexes), ['d', 'e', 'f', 'g', 'origin'])

  await testDB3.close()
})

test('complex index test', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: ['a+b', 'c+d', 'e']
  })
  await testDB.open()

  // check that the table was created correctly
  t.truthy(testDB.firstTable)
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a+b', 'c+d', 'e', 'origin'])

  await testDB.close()
})

test('multi-def index test', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: [
      {name: 'a', def: ['a', 'b']}, 
      {name: 'c+d', def: ['c+d', 'cee+dee']},
      {name: 'e', def: ['*e', '*eee']}
    ]
  })
  await testDB.open()

  // check that the table was created correctly
  t.truthy(testDB.firstTable)
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'c+d', 'e', 'origin'])

  await testDB.close()
})

test('multi-def index must have matching definitions', async t => {
  const testDB = newDB()

  t.throws(() => testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: [
      {name: 'a', def: ['a', 'b+c']}
    ]
  }))

  t.throws(() => testDB.define('firstTable', {
    path: '/table1/*.json',
    buildPath: record => `/table1/${record.id}.json`,
    index: [
      {name: 'a', def: ['*a', 'b']}
    ]
  }))

  await testDB.close()
})
