const test = require('ava')
const {newDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('preprocessor-serializer.js'))

var archive

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('multi', {
    filePattern: ['/multi/*.json'],
    schema: {
      type: 'object',
      properties: {
        fileAttr: {type: 'string'}
      },
      required: ['fileAttr']
    },
    preprocess: record => ({
      recordOnly: record.fileAttr + 'record',
      fileAttr: record.fileAttr
    }),
    serialize: record => ({fileAttr: record.fileAttr})
  })
  await testDB.open()
  await testDB.indexArchive(archive)
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
  archive = await def(async write => {
    await write('/multi/1.json', {fileAttr: 'foo'})
    await write('/multi/2.json', {fileAttr: 'bar'})
    await write('/multi/3.json', {fileAttr: 'baz'})
  })
})

test('Different data is stored in the records than in the files', async t => {
  const testDB = await setupNewDB()
  // check records
  var results = await testDB.multi.toArray()
  t.deepEqual(results[0].fileAttr, 'foo')
  t.deepEqual(results[0].recordOnly, 'foorecord')
  t.deepEqual(results[1].fileAttr, 'bar')
  t.deepEqual(results[1].recordOnly, 'barrecord')
  t.deepEqual(results[2].fileAttr, 'baz')
  t.deepEqual(results[2].recordOnly, 'bazrecord')
  // write each record
  await testDB.multi.put(results[0].getRecordURL(), results[0])
  await testDB.multi.put(results[1].getRecordURL(), results[1])
  await testDB.multi.put(results[2].getRecordURL(), results[2])
  // check files
  var files = await Promise.all([
    archive.readFile('/multi/1.json'),
    archive.readFile('/multi/2.json'),
    archive.readFile('/multi/3.json'),
  ])
  files = files.map(JSON.parse)
  t.deepEqual(files[0].fileAttr, 'foo')
  t.deepEqual(files[0].recordOnly, undefined)
  t.deepEqual(files[1].fileAttr, 'bar')
  t.deepEqual(files[1].recordOnly, undefined)
  t.deepEqual(files[2].fileAttr, 'baz')
  t.deepEqual(files[2].recordOnly, undefined)
  await testDB.close()
})