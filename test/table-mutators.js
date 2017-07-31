const test = require('ava')
const {newDB, ts} = require('./lib/util')
const IDB = require('../lib/idb-wrapper')
const {debug} = require('../lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

var archives = []

async function setupNewDB () {
  const testDB = newDB()
  testDB.schema({
    version: 1,
    single: {
      singular: true,
      index: ['first', 'second', 'first+second', 'third']
    },
    multi: {
      primaryKey: 'first',
      index: ['first', 'second', 'first+second', 'third']
    }
  })
  await testDB.open()
  await testDB.addArchives(archives)
  return testDB
}

test.before('setup archives', async () => {
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
      await write('/multi/1.json', {first: 'first' + i, second: (i+1)*100, third: 'third' + i + 'multi1'})
      await write('/multi/2.json', {first: 'first' + i, second: i, third: 'third' + i + 'multi2'})
      await write('/multi/3.json', {first: 'first' + (i+1)*100, second: i, third: 'third' + i + 'multi3'})
    }))
  }
})

test('Table.add()', async t => {
  var result
  const testDB = await setupNewDB()

  // add a multi record
  result = await testDB.multi.add(archives[0], {
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
  result = await testDB.single.add(archives[0], {
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
  const testDB = await setupNewDB()

  // delete a multi record
  result = await testDB.multi.delete(archives[0], 4)
  t.is(result, 1)

  // fetch it back
  result = await testDB.multi.get('first', 4)
  t.falsy(result)

  // delete the single record
  result = await testDB.single.delete(archives[0])

  // fetch it back
  result = await testDB.single.get(archives[0].url + '/single.json')
  t.falsy(result)

  await testDB.close()
})

test('Table.update()', async t => {
  const testDB = await setupNewDB()

  // update a multi record
  var record = await testDB.multi.get('third', 'third0multi3')
  record.n = 0
  debug('== update by record')
  t.is(await testDB.multi.update(record), 1)
  t.is((await testDB.multi.get('third', 'third0multi3')).n, 0)
  debug('== update by url')
  t.is(await testDB.multi.update(record._url, {n: 1}), 1)
  t.is((await testDB.multi.get('third', 'third0multi3')).n, 1)
  debug('== update by key')
  t.is(await testDB.multi.update(archives[9], 'first0', {foo: 'bar'}), 2)

  // update a single record
  var record = await testDB.single.getRecordSet().first()
  record.n = 0
  debug('== update by record')
  t.is(await testDB.single.update(record), 1)
  t.is((await testDB.single.get(record._url)).n, 0)
  debug('== update by url')
  t.is(await testDB.single.update(record._url, {n: 1}), 1)
  t.is((await testDB.single.get(record._url)).n, 1)
  debug('== update by archive')
  t.is(await testDB.single.update(archives[9], {foo: 'bar'}), 1)

  await testDB.close()
})

test('Table.upsert()', async t => {
  const testDB = await setupNewDB()

  // upsert a multi record
  const url = await testDB.multi.upsert(archives[0], {first: 'upFirst', second: 'upSecond', third: 'upThird'})
  t.is(typeof url, 'string')
  t.is(await testDB.multi.upsert(archives[0], {first: 'upFirst', second: 'UPSECOND', third: 'UPTHIRD'}), 1)
  t.is((await testDB.multi.get('first', 'upFirst')).third, 'UPTHIRD')

  // upsert a single record
  const url2 = await testDB.single.upsert(archives[0], {first: 'upFirst', second: 'upSecond', third: 'upThird'})
  t.is(url2, archives[0].url + '/single.json')
  t.is(await testDB.single.upsert(archives[0], {first: 'upFirst', second: 'UPSECOND', third: 'UPTHIRD'}), 1)
  t.is((await testDB.single.get('first', 'upFirst')).third, 'UPTHIRD')

  await testDB.close()
})
