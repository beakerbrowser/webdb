const test = require('ava')
const {newDB, reopenDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')
const Ajv = require('ajv')

test.before(() => console.log('one-time-index.js'))

var aliceArchive
var bobArchive

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('profile', {
    filePattern: '/profile.json',
    index: 'name',
    validate: (new Ajv()).compile({
      type: 'object',
      properties: {
        name: {type: 'string'},
        bio: {type: 'string'}
      },
      required: ['name']
    })
  })
  testDB.define('broadcasts', {
    filePattern: '/broadcasts/*.json',
    index: ['createdAt', 'type+createdAt'],
    validate: (new Ajv()).compile({
      type: 'object',
      properties: {
        type: {type: 'string'},
        createdAt: {type: 'number'}
      },
      required: ['type', 'createdAt']
    })
  })
  await testDB.open()
  return testDB
}

test.before('setup archives', async () => {
  // setup alice
  const a = aliceArchive = await DatArchive.create({
    localPath: tempy.directory(),
    title: 'Alice Archive',
    author: {url: 'dat://ffffffffffffffffffffffffffffffff'}
  })
  await a.writeFile('/profile.json', JSON.stringify({name: 'alice', bio: 'Cool computer girl', avatarUrl: 'alice.png'}))
  await a.mkdir('/broadcasts')
  a.broadcast1TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast1TS}.json`, JSON.stringify({type: 'comment', text: 'Hello, world!', createdAt: a.broadcast1TS}))
  a.broadcast2TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast2TS}.json`, JSON.stringify({type: 'comment', text: 'Whoop', createdAt: a.broadcast2TS}))
  a.broadcast3TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast3TS}.json`, JSON.stringify({type: 'image', imageUrl: 'foo.png', createdAt: a.broadcast3TS}))
  await a.writeFile(`/broadcasts/bad.json`, JSON.stringify({this: 'is not included'}))

  // setup bob
  const b = bobArchive = await DatArchive.create({
    localPath: tempy.directory(),
    title: 'Bob Archive'
  })
  await b.writeFile('/profile.json', JSON.stringify({name: 'bob', bio: 'Cool computer guy', avatarUrl: 'alice.png'}))
  await b.mkdir('/broadcasts')
  b.broadcast1TS = ts()
  await b.writeFile(`/broadcasts/${b.broadcast1TS}.json`, JSON.stringify({type: 'comment', text: 'Hello, world!', createdAt: b.broadcast1TS}))
  b.broadcast2TS = ts()
  await b.writeFile(`/broadcasts/${b.broadcast2TS}.json`, JSON.stringify({type: 'image', imageUrl: 'baz.png', createdAt: b.broadcast2TS}))
  await b.writeFile(`/broadcasts/bad.json`, JSON.stringify({this: 'is not included'}))
})

test('index and unindex single files', async t => {
  var testDB = await setupNewDB()

  // profile.json

  await testDB.indexFile(aliceArchive, '/profile.json')

  var profile = await testDB.profile.level.get(aliceArchive.url + '/profile.json')
  t.deepEqual(profile, {
    url: aliceArchive.url + '/profile.json',
    origin: aliceArchive.url,
    indexedAt: profile.indexedAt,
    record: {
      avatarUrl: 'alice.png',
      name: 'alice',
      bio: 'Cool computer girl'
    }
  })
  await t.throws(testDB.profile.level.get(bobArchive.url + '/profile.json'))
  await t.throws(testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json'))

  await testDB.unindexFile(aliceArchive, '/profile.json')

  await t.throws(testDB.profile.level.get(aliceArchive.url + '/profile.json'))
  await t.throws(testDB.profile.level.get(bobArchive.url + '/profile.json'))
  await t.throws(testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json'))

  // 2 broadcasts

  await testDB.indexFile(aliceArchive, '/broadcasts/' + aliceArchive.broadcast1TS + '.json')
  await testDB.indexFile(aliceArchive, '/broadcasts/' + aliceArchive.broadcast2TS + '.json')

  await t.throws(testDB.profile.level.get(aliceArchive.url + '/profile.json'))
  await t.throws(testDB.profile.level.get(bobArchive.url + '/profile.json'))
  var broadcast1 = await testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json')
  t.deepEqual(broadcast1, {
    url: aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json',
    origin: aliceArchive.url,
    indexedAt: broadcast1.indexedAt,
    record: {
      type: 'comment',
      text: 'Hello, world!',
      createdAt: aliceArchive.broadcast1TS
    }
  })
  var broadcast2 = await testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast2TS + '.json')
  t.deepEqual(broadcast2, {
    url: aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast2TS + '.json',
    origin: aliceArchive.url,
    indexedAt: broadcast2.indexedAt,
    record: {
      type: 'comment',
      text: 'Whoop',
      createdAt: aliceArchive.broadcast2TS
    }
  })

  await testDB.unindexFile(aliceArchive, '/broadcasts/' + aliceArchive.broadcast1TS + '.json')
  await testDB.unindexFile(aliceArchive, '/broadcasts/' + aliceArchive.broadcast2TS + '.json')

  await t.throws(testDB.profile.level.get(aliceArchive.url + '/profile.json'))
  await t.throws(testDB.profile.level.get(bobArchive.url + '/profile.json'))
  await t.throws(testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json'))
  await t.throws(testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast2TS + '.json'))

  await testDB.close()
})
