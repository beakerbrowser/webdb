const test = require('ava')
const {newDB, ts} = require('./lib/util')
const {debug} = require('../lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('table-mutators.js'))

async function setupNewDB () {
  var archives = []
  async function def (fn) {
    const a = await DatArchive.create({localPath: tempy.directory()})
    await a.mkdir('/multi')
    const write = (path, record) => a.writeFile(path, JSON.stringify(record))
    await fn(write, a)
    return a
  }
  for (let i = 0; i < 10; i++) {
    archives.push(await def(async write => {
      await write('/single.json', {first: 'first' + i, second: i, third: 'third' + i + 'single'})
      await write(`/multi/first${i}.json`, {first: 'first' + i, second: (i+1)*100, third: 'third' + i + 'multi1'})
      await write(`/multi/first${i}.json`, {first: 'first' + i, second: i, third: 'third' + i + 'multi2'})
      await write(`/multi/first${(i+1)*100}.json`, {first: 'first' + (i+1)*100, second: i, third: 'third' + i + 'multi3'})
    }))
  }

  const testDB = newDB()
  testDB.define('single', {
    singular: true,
    index: ['first', 'second', 'first+second', 'third']
  })
  testDB.define('multi', {
    primaryKey: 'first',
    index: ['first', 'second', 'first+second', 'third']
  })
  await testDB.open()
  await testDB.addArchives(archives)
  return [archives, testDB]
}

test('Table.put()', async t => {
  var result
  const [archives, testDB] = await setupNewDB()

  // add a multi record
  result = await testDB.multi.put(archives[0].url + '/multi/4.json', {
    first: 4,
    second: 'foobar',
    third: 'whoop'
  })
  t.is(result, archives[0].url + '/multi/4.json')

  // fetch it back
  result = await testDB.multi.get('first', 4)
  t.is(result.first, 4)
  t.is(result.second, 'foobar')
  t.is(result.third, 'whoop')

  // overwrite the single record
  result = await testDB.single.put(archives[0].url + '/single.json', {
    first: 'first100000',
    second: 100000,
    third: 'third100000single'
  })
  t.is(result, archives[0].url + '/single.json')

  // fetch it back
  result = await testDB.single.get(archives[0].url + '/single.json')
  t.is(result.first, 'first100000')
  t.is(result.second, 100000)
  t.is(result.third, 'third100000single')

  await testDB.close()
})

test('Table.delete()', async t => {
  var result
  const [archives, testDB] = await setupNewDB()

  // delete a multi record
  result = await testDB.multi.delete(archives[0].url + '/multi/first0.json')
  t.is(result, 1)

  // fetch it back
  result = await testDB.multi.get('first', 'first0')
  t.falsy(result)

  // delete the single record
  result = await testDB.single.delete(archives[0].url + '/single.json')

  // fetch it back
  result = await testDB.single.get(archives[0].url + '/single.json')
  t.falsy(result)

  await testDB.close()
})

test('Table.update()', async t => {
  const [archives, testDB] = await setupNewDB()

  // update a multi record
  var record = await testDB.multi.get('third', 'third0multi3')
  record.n = 0
  debug('== update by url')
  t.is(await testDB.multi.update(record.url, {n: 1}), 1)
  t.is((await testDB.multi.get('third', 'third0multi3')).n, 1)

  // update a single record
  var record = await testDB.single.query().first()
  record.n = 0
  debug('== update by url')
  t.is(await testDB.single.update(record.url, {n: 1}), 1)
  t.is((await testDB.single.get(record.url)).n, 1)

  await testDB.close()
})

test('Table.upsert() using an object', async t => {
  const [archives, testDB] = await setupNewDB()

  // upsert a multi record
  const url = await testDB.multi.upsert(archives[0].url + '/multi/5.json', {first: 'upFirst', second: 'upSecond', third: 'upThird'})
  t.is(url, archives[0].url + '/multi/5.json')
  t.is(await testDB.multi.upsert(archives[0].url + '/multi/5.json', {first: 'upFirst', second: 'UPSECOND', third: 'UPTHIRD'}), 1)
  t.is((await testDB.multi.get('first', 'upFirst')).third, 'UPTHIRD') // this test data is upthird

  // upsert a single record
  t.is(await testDB.single.upsert(archives[0].url + '/single.json', {first: 'upFirst', second: 'upSecond', third: 'upThird'}), 1)
  t.is((await testDB.single.get('first', 'upFirst')).third, 'upThird')
  t.is(await testDB.single.upsert(archives[0].url + '/single.json', {first: 'upFirst', second: 'UPSECOND', third: 'UPTHIRD'}), 1)
  t.is((await testDB.single.get('first', 'upFirst')).third, 'UPTHIRD')

  await testDB.close()
})

test('Table.upsert() using a function', async t => {
  const [archives, testDB] = await setupNewDB()

  const updater = record => {
    if (!record) {
      return {first: 'upFirst', second: 'upSecond', third: 'upThird'}
    }
    record.third = record.third.toUpperCase()
    return record
  }

  // upsert a multi record
  const url = await testDB.multi.upsert(archives[0].url + '/multi/6.json', updater)
  t.is(url, archives[0].url + '/multi/6.json')
  t.is(await testDB.multi.upsert(archives[0].url + '/multi/6.json', updater), 1)
  t.is((await testDB.multi.get('first', 'upFirst')).third, 'UPTHIRD')

  // upsert a single record
  t.is(await testDB.single.upsert(archives[0].url + '/single.json', updater), 1)
  t.is((await testDB.single.get('first', 'first0')).third, 'THIRD0SINGLE')

  await testDB.close()
})
