const test = require('ava')
const {newDB, ts} = require('./lib/util')
const IDB = require('../lib/idb-wrapper')
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
      await write('/multi/1.json', {first: 'first' + i, second: i, third: 'third' + i + 'multi1'})
      await write('/multi/2.json', {first: 'first' + i, second: i*100, third: 'third' + i + 'multi2'})
      await write('/multi/3.json', {first: 'first' + i*100, second: i, third: 'third' + i + 'multi3'})
    }))
  }
})

test('first()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.getRecordSet().first()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  result = await testDB.multi.getRecordSet().first()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  await testDB.close()
})