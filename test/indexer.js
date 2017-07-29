const test = require('ava')
const {newDB, ts} = require('./lib/util')
const IDB = require('../lib/idb-wrapper')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

var aliceArchive
var bobArchive

async function setupNewDB () {
  const testDB = newDB()
  testDB.schema({
    version: 1,
    profile: {
      singular: true,
      index: 'name',
      validator: record => {
        if (!(record.name && typeof record.name === 'string')) {
          return false
        }
        return {
          name: record.name,
          bio: record.bio
        }
      }
    },
    broadcasts: {
      primaryKey: 'createdAt',
      index: ['createdAt', 'type+createdAt']
    }
  })
  await testDB.open()
  return testDB
}

test.before('setup archives', async () => {
  // setup alice
  const a = aliceArchive = await DatArchive.create({
    localPath: tempy.directory(),
    title: 'Alice Archive'
  })
  await a.writeFile('/profile.json', JSON.stringify({name: 'alice', bio: 'Cool computer girl', avatarUrl: 'notincluded.png'}))
  await a.mkdir('/broadcasts')
  a.broadcast1TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast1TS}.json`, JSON.stringify({type: 'comment', text: 'Hello, world!', createdAt: a.broadcast1TS}))
  a.broadcast2TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast2TS}.json`, JSON.stringify({type: 'comment', text: 'Whoop', createdAt: a.broadcast2TS}))
  a.broadcast3TS = ts()
  await a.writeFile(`/broadcasts/${a.broadcast3TS}.json`, JSON.stringify({type: 'image', imageUrl: 'foo.png', createdAt: a.broadcast3TS}))

  // setup bob
  const b = bobArchive = await DatArchive.create({
    localPath: tempy.directory(),
    title: 'Bob Archive'
  })
  await b.writeFile('/profile.json', JSON.stringify({name: 'bob', bio: 'Cool computer guy', avatarUrl: 'notincluded.png'}))
  await b.mkdir('/broadcasts')
  b.broadcast1TS = ts()
  await b.writeFile(`/broadcasts/${b.broadcast1TS}.json`, JSON.stringify({type: 'comment', text: 'Hello, world!', createdAt: b.broadcast1TS}))
  b.broadcast2TS = ts()
  await b.writeFile(`/broadcasts/${b.broadcast2TS}.json`, JSON.stringify({type: 'image', imageUrl: 'baz.png', createdAt: b.broadcast2TS}))
})

test('index an archive', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await testDB.addArchive(aliceArchive)

  // test the indexed values
  await testAliceIndex(t, testDB)

  await testDB.close()
})

test('index two archives', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await Promise.all([
    testDB.addArchive(aliceArchive),
    testDB.addArchive(bobArchive)
  ])

  // test the indexed values
  await testAliceIndex(t, testDB)
  await testBobIndex(t, testDB)

  await testDB.close()
})

test('index two archives, then make changes', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await Promise.all([
    testDB.addArchive(aliceArchive),
    testDB.addArchive(bobArchive)
  ])

  // test the indexed values
  await testAliceIndex(t, testDB)
  await testBobIndex(t, testDB)

  // write changes to alice's profile.json
  await aliceArchive.writeFile('/profile.json', JSON.stringify({name: 'alice', bio: '_Very_ cool computer girl'}))
  await new Promise(resolve => testDB.profile.once('index-updated', resolve))

  // test updated values
  var profile = await IDB.get(testDB.profile, aliceArchive.url + '/profile.json')
  t.truthy(profile)
  t.is(profile.name, 'alice')
  t.is(profile.bio, '_Very_ cool computer girl')

  // add a new broadcast to alice
  aliceArchive.broadcast4TS = ts()
  await aliceArchive.writeFile(`/broadcasts/${aliceArchive.broadcast4TS}.json`, JSON.stringify({type: 'comment', text: 'Index me!', createdAt: aliceArchive.broadcast4TS}))
  await new Promise(resolve => testDB.broadcasts.once('index-updated', resolve))

  // test updated values
  var broadcast4 = await IDB.get(testDB.broadcasts, aliceArchive.url + `/broadcasts/${aliceArchive.broadcast4TS}.json`)
  t.truthy(broadcast4)
  t.is(broadcast4.type, 'comment')
  t.is(broadcast4.text, 'Index me!')
  t.is(broadcast4.createdAt, aliceArchive.broadcast4TS)

  // delete broadcast 1 from alice
  await aliceArchive.unlink(`/broadcasts/${aliceArchive.broadcast1TS}.json`)
  await new Promise(resolve => testDB.broadcasts.once('index-updated', resolve))

  // test updated values
  var broadcast4 = await IDB.get(testDB.broadcasts, aliceArchive.url + `/broadcasts/${aliceArchive.broadcast1TS}.json`)
  t.falsy(broadcast4)

  await testDB.close()
})

test('make schema changes that require a full rebuild', async t => {
  // TODO
  t.pass()
})

async function testAliceIndex (t, testDB) {
  var profile = await IDB.get(testDB.profile, aliceArchive.url + '/profile.json')
  t.truthy(profile)
  t.is(profile.name, 'alice')
  t.is(profile.bio, 'Cool computer girl')
  t.falsy(profile.avatarUrl) // not included by the validator
  var broadcast1 = await IDB.get(testDB.broadcasts, aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast1TS + '.json')
  t.truthy(broadcast1)
  t.is(broadcast1.type, 'comment')
  t.is(broadcast1.text, 'Hello, world!')
  t.is(broadcast1.createdAt, aliceArchive.broadcast1TS)
  var broadcast2 = await IDB.get(testDB.broadcasts, aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast2TS + '.json')
  t.truthy(broadcast2)
  t.is(broadcast2.type, 'comment')
  t.is(broadcast2.text, 'Whoop')
  t.is(broadcast2.createdAt, aliceArchive.broadcast2TS)
  var broadcast3 = await IDB.get(testDB.broadcasts, aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast3TS + '.json')
  t.truthy(broadcast3)
  t.is(broadcast3.type, 'image')
  t.is(broadcast3.imageUrl, 'foo.png')
  t.is(broadcast3.createdAt, aliceArchive.broadcast3TS)
}

async function testBobIndex (t, testDB) {
  var profile = await IDB.get(testDB.profile, bobArchive.url + '/profile.json')
  t.truthy(profile)
  t.is(profile.name, 'bob')
  t.is(profile.bio, 'Cool computer guy')
  t.falsy(profile.avatarUrl) // not included by the validator
  var broadcast1 = await IDB.get(testDB.broadcasts, bobArchive.url + '/broadcasts/' + bobArchive.broadcast1TS + '.json')
  t.truthy(broadcast1)
  t.is(broadcast1.type, 'comment')
  t.is(broadcast1.text, 'Hello, world!')
  t.is(broadcast1.createdAt, bobArchive.broadcast1TS)
  var broadcast2 = await IDB.get(testDB.broadcasts, bobArchive.url + '/broadcasts/' + bobArchive.broadcast2TS + '.json')
  t.truthy(broadcast2)
  t.is(broadcast2.type, 'image')
  t.is(broadcast2.imageUrl, 'baz.png')
  t.is(broadcast2.createdAt, bobArchive.broadcast2TS)
}