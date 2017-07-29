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

test('RecordSet.delete()', async t => {
  var result
  const testDB = await setupNewDB()

  // delete multi records
  t.is(await testDB.multi.filter(record => record.second < 5).delete(), 10)
  t.is(await testDB.multi.count(), 20)

  // delete single records
  t.is(await testDB.single.filter(record => record.second < 5).delete(), 5)
  t.is(await testDB.single.count(), 5)

  await testDB.close()
})

test('RecordSet.update()', async t => {
  const incrementSecond = record => { record.second++ }
  const testDB = await setupNewDB()

  // update multi records by object
  t.is(await testDB.multi.filter(record => record.second >= 5).update({second: -1}), 20)
  t.is(await testDB.multi.where('second').equals(-1).count(), 20)

  // update multi records by object
  t.is(await testDB.multi.where('second').equals(-1).update(incrementSecond), 20)
  t.is(await testDB.multi.where('second').equals(0).count(), 20)

  // update single records by object
  t.is(await testDB.single.filter(record => record.second >= 5).update({second: -1}), 5)
  t.is(await testDB.single.where('second').equals(-1).count(), 5)

  // update single records by object
  t.is(await testDB.single.where('second').equals(-1).update(incrementSecond), 5)
  t.is(await testDB.single.where('second').equals(0).count(), 5)

  await testDB.close()
})