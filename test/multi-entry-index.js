const test = require('ava')
const {newDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('multi-entry-index.js'))

var archives = []

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('table', {
    filePattern: '/table/*.json',
    index: ['key', '*fruits']
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
    await write('/table/1.json', {key: 1, fruits: 'apple'})
    await write('/table/2.json', {key: 2, fruits: ['apple', 'banana']})
    await write('/table/3.json', {key: 3, fruits: ['apple', 'banana', 'cherry']})
  }))
  archives.push(await def(async write => {
    await write('/table/1.json', {key: 1, fruits: 'cherry'})
    await write('/table/2.json', {key: 2, fruits: ['apple', 'banana']})
  }))
})

test('above()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').above('banana').toArray()
  t.is(results.length, 2)
  t.is(results.length, results.filter(v => v.fruits === 'cherry' || v.fruits.indexOf('cherry') >= 0).length)
  await testDB.close()
})

test('aboveOrEqual()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').aboveOrEqual('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.filter(v => v.fruits === 'apple').length, 0)
  await testDB.close()
})

test('anyOf()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').anyOf('banana', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.filter(v => v.fruits === 'apple').length, 0)
  await testDB.close()
})

test('anyOfIgnoreCase()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').anyOfIgnoreCase('BANANA', 'CHERRY').toArray()
  t.truthy(results.length > 0)
  t.is(results.filter(v => v.fruits === 'apple').length, 0)
  await testDB.close()
})

test('below()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').below('banana').toArray()
  t.is(results.length, 4)
  t.is(results.length, results.filter(v => v.fruits === 'apple' || v.fruits.indexOf('apple') >= 0).length)
  await testDB.close()
})

test('belowOrEqual()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').belowOrEqual('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'apple' || v.fruits.indexOf('apple') >= 0).length)
  await testDB.close()
})

test('between()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').between('apple', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

test('equals()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').equals('banana').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

test('equalsIgnoreCase()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').equalsIgnoreCase('BANANA').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

test('noneOf()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').noneOf('apple', 'cherry').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

test('notEqual()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').notEqual('cherry').toArray()
  t.truthy(results.length > 0)
  t.is(0, results.filter(v => v.fruits === 'cherry').length)
  await testDB.close()
})

test('startsWith()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').startsWith('banan').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

test('startsWithAnyOf()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').startsWithAnyOf('banan', 'cherr').toArray()
  t.truthy(results.length > 0)
  t.is(results.filter(v => v.fruits === 'apple').length, 0)
  await testDB.close()
})

test('startsWithAnyOfIgnoreCase()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').startsWithAnyOfIgnoreCase('BANAN', 'CHERR').toArray()
  t.truthy(results.length > 0)
  t.is(results.filter(v => v.fruits === 'apple').length, 0)
  await testDB.close()
})

test('startsWithIgnoreCase()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.table.where('fruits').startsWithIgnoreCase('BANAN').toArray()
  t.truthy(results.length > 0)
  t.is(results.length, results.filter(v => v.fruits === 'banana' || v.fruits.indexOf('banana') >= 0).length)
  await testDB.close()
})

