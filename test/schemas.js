const test = require('ava')
const {newDB} = require('./lib/util')

test.before(() => console.log('schemas.js'))

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
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'b', 'c', 'origin'])

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
  t.truthy(testDB.firstTable.level)
  t.deepEqual(Object.keys(testDB.firstTable.level.indexes), ['a', 'b', 'c', 'origin'])
  t.truthy(testDB.secondTable)
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'e', 'f', 'origin'])

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
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'e', 'f', 'origin'])
  
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
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'f', 'g', 'origin'])

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
  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['d', 'f', 'g', 'origin'])
  t.truthy(testDB.thirdTable)
  t.truthy(testDB.thirdTable.level)
  t.deepEqual(Object.keys(testDB.thirdTable.level.indexes), ['origin'])

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

  t.truthy(testDB.secondTable.level)
  t.deepEqual(Object.keys(testDB.secondTable.level.indexes), ['z', 'origin'])
  t.truthy(testDB.fourthTable.level)
  t.deepEqual(Object.keys(testDB.fourthTable.level.indexes), ['origin'])

  await testDB.close()
})

test('complex index test', async t => {
  const testDB = newDB()

  // setup the schema
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: ['a+b', 'c+d', 'e']
    }
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
  testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: [
        {name: 'a', def: ['a', 'b']}, 
        {name: 'c+d', def: ['c+d', 'cee+dee']},
        {name: 'e', def: ['*e', '*eee']}
      ]
    }
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

  t.throws(() => testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: [
        {name: 'a', def: ['a', 'b+c']}
      ]
    }
  }))

  t.throws(() => testDB.schema({
    version: 1,
    firstTable: {
      path: '/table1/*.json',
      buildPath: record => `/table1/${record.id}.json`,
      index: [
        {name: 'a', def: ['*a', 'b']}
      ]
    }
  }))

  await testDB.close()
})
