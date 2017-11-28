const test = require('ava')
const {newDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('multi-def-index.js'))

var archives = []

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('table', {
    primaryKey: 'key',
    index: [
      'key',
      {name: 'fruits', def: ['*fruits', '*theFruits']},
      {name: 'color', def: ['color', 'colour', 'kuller']},
      {name: 'colorCompound', def: ['color+key', 'colour+key', 'kuller+key']}
    ]
  })
  await testDB.open()
  await testDB.addArchives(archives)
  return testDB
}

test.before('setup archives', async () => {
  async function def (fn) {
    const a = await DatArchive.create({localPath: tempy.directory()})
    await a.mkdir('/table')
    const write = (path, record) => a.writeFile(path, JSON.stringify(record))
    await fn(write, a)
    return a
  }
  archives.push(await def(async write => {
    await write('/table/1.json', {key: 1, fruits: 'apple', color: 'red'})
    await write('/table/2.json', {key: 2, theFruits: ['apple', 'banana'], colour: 'green'})
    await write('/table/3.json', {key: 3, fruits: ['apple', 'banana', 'cherry'], kuller: 'blue'})
  }))
  archives.push(await def(async write => {
    await write('/table/1.json', {key: 1, theFruits: 'cherry', color: 'green'})
    await write('/table/2.json', {key: 2, fruits: ['apple', 'banana'], colour: 'red'})
  }))
})

function normalizeRecord (record) {
  if (record.theFruits) record.fruits = record.theFruits
  if (record.colour) record.color = record.colour
  if (record.kuller) record.color = record.kuller
  return record
}

test('above()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').above('banana').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'cherry' || v.fruits.indexOf('cherry') >= 0).length)

  results = await testDB.table.where('color').above('green').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'red').length)

  results = await testDB.table.where('colorCompound').above(['green', 1]).toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'red' || v.key === 2).length)

  await testDB.close()
})

test('aboveOrEqual()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').aboveOrEqual('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.map(normalizeRecord).filter(v => v.fruits === 'apple').length, 0)

  results = await testDB.table.where('color').aboveOrEqual('green').toArray()
  t.is(results.length, 4)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' || v.color === 'red').length)

  results = await testDB.table.where('colorCompound').aboveOrEqual(['green', 1]).toArray()
  t.is(results.length, 4)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'red' || v.color === 'green').length)

  await testDB.close()
})

test('anyOf()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').anyOf('banana', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.map(normalizeRecord).filter(v => v.fruits === 'apple').length, 0)

  results = await testDB.table.where('color').anyOf('green', 'red').toArray()
  t.is(results.length, 4)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' || v.color === 'red').length)

  await testDB.close()
})

test('anyOfIgnoreCase()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').anyOfIgnoreCase('BANANA', 'CHERRY').toArray()
  t.truthy(results.length > 0)
  t.is(results.map(normalizeRecord).filter(v => v.fruits === 'apple').length, 0)

  results = await testDB.table.where('color').anyOfIgnoreCase('GREEN', 'RED').toArray()
  t.is(results.length, 4)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' || v.color === 'red').length)

  await testDB.close()
})

test('below()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').below('banana').toArray()
  t.is(results.length, 4)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'apple' || v.fruits.indexOf('apple') >= 0).length)

  results = await testDB.table.where('color').below('green').toArray()
  t.is(results.length, 1)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue').length)

  results = await testDB.table.where('colorCompound').below(['green', 2]).toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue' || v.key === 1).length)

  await testDB.close()
})

test('belowOrEqual()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').belowOrEqual('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'apple' || v.fruits.indexOf('apple') >= 0).length)

  results = await testDB.table.where('color').belowOrEqual('green').toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue' || v.color === 'green').length)

  results = await testDB.table.where('colorCompound').belowOrEqual(['green', 2]).toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue' || v.color === 'green').length)

  await testDB.close()
})

test('between()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').between('apple', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)

  results = await testDB.table.where('color').between('brown', 'orange').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  results = await testDB.table.where('colorCompound').between(['green', 1], ['green', 3]).toArray()
  t.is(results.length, 1)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' && v.key === 2).length)

  results = await testDB.table.where('colorCompound').between(['green', 1], ['green', 3], {includeLower: true}).toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  await testDB.close()
})

test('equals()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').equals('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)

  results = await testDB.table.where('color').equals('green').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  results = await testDB.table.where('colorCompound').equals(['green', 2]).toArray()
  t.is(results.length, 1)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' && v.key === 2).length)

  await testDB.close()
})

test('equalsIgnoreCase()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').equalsIgnoreCase('BANANA').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)

  results = await testDB.table.where('color').equalsIgnoreCase('GREEN').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  await testDB.close()
})

test('noneOf()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').noneOf('apple', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)

  results = await testDB.table.where('color').noneOf('red', 'blue').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  await testDB.close()
})

test('notEqual()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').notEqual('cherry').toArray()
  t.truthy(results.length > 0)
  t.is(0, results.map(normalizeRecord).filter(v => v.fruits === 'cherry').length)

  results = await testDB.table.where('color').notEqual('red').toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green' || v.color === 'blue').length)

  await testDB.close()
})

test('startsWith()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').startsWith('banan').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)

  results = await testDB.table.where('color').startsWith('g').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  await testDB.close()
})

test('startsWithAnyOf()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').startsWithAnyOf('banan', 'cherr').toArray()
  t.truthy(results.length > 0)
  t.is(results.map(normalizeRecord).filter(v => v.fruits === 'apple').length, 0)

  results = await testDB.table.where('color').startsWithAnyOf('b', 'g').toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue' || v.color === 'green').length)

  await testDB.close()
})

test('startsWithAnyOfIgnoreCase()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').startsWithAnyOfIgnoreCase('BANAN', 'CHERR').toArray()
  t.truthy(results.length > 0)
  t.is(results.map(normalizeRecord).filter(v => v.fruits === 'apple').length, 0)

  results = await testDB.table.where('color').startsWithAnyOfIgnoreCase('B', 'G').toArray()
  t.is(results.length, 3)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'blue' || v.color === 'green').length)

  await testDB.close()
})

test('startsWithIgnoreCase()', async t => {
  const testDB = await setupNewDB()

  var results = await testDB.table.where('fruits').startsWithIgnoreCase('BANAN').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  
  results = await testDB.table.where('color').startsWithIgnoreCase('G').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.map(normalizeRecord).filter(v => v.color === 'green').length)

  await testDB.close()
})

