const test = require('ava')
const {newDB, ts} = require('./lib/util')
const IDB = require('../lib/idb-wrapper')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

var aliceArchive

async function getAliceArchive () {
  if (aliceArchive) return aliceArchive
  aliceArchive = await DatArchive.create({
    localPath: tempy.directory(),
    title: 'Alice Archive'
  })
  return aliceArchive
}

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

test('index an archive', async t => {
  // setup the archive
  var now
  var archive = await getAliceArchive()
  await archive.writeFile('/profile.json', JSON.stringify({name: 'alice', bio: 'Cool computer girl', avatarUrl: 'notincluded.png'}))
  await archive.mkdir('/broadcasts')
  var broadcast1TS = ts()
  await archive.writeFile(`/broadcasts/${broadcast1TS}.json`, JSON.stringify({type: 'comment', text: 'Hello, world!', createdAt: broadcast1TS}))
  var broadcast2TS = ts()
  await archive.writeFile(`/broadcasts/${broadcast2TS}.json`, JSON.stringify({type: 'comment', text: 'Whoop', createdAt: broadcast2TS}))
  var broadcast3TS = ts()
  await archive.writeFile(`/broadcasts/${broadcast3TS}.json`, JSON.stringify({type: 'image', imageUrl: 'foo.png', createdAt: broadcast3TS}))

  // index the archive
  var testDB = await setupNewDB()
  await testDB.addArchive(archive)

  // test the indexed values
  var profile = await IDB.get(testDB.profile, archive.url + '/profile.json')
  t.truthy(profile)
  t.is(profile.name, 'alice')
  t.is(profile.bio, 'Cool computer girl')
  t.falsy(profile.avatarUrl) // not included by the validator
  var broadcast1 = await IDB.get(testDB.broadcasts, archive.url + '/broadcasts/' + broadcast1TS + '.json')
  t.truthy(broadcast1)
  t.is(broadcast1.type, 'comment')
  t.is(broadcast1.text, 'Hello, world!')
  t.is(broadcast1.createdAt, broadcast1TS)
  var broadcast2 = await IDB.get(testDB.broadcasts, archive.url + '/broadcasts/' + broadcast2TS + '.json')
  t.truthy(broadcast2)
  t.is(broadcast2.type, 'comment')
  t.is(broadcast2.text, 'Whoop')
  t.is(broadcast2.createdAt, broadcast2TS)
  var broadcast3 = await IDB.get(testDB.broadcasts, archive.url + '/broadcasts/' + broadcast3TS + '.json')
  t.truthy(broadcast3)
  t.is(broadcast3.type, 'image')
  t.is(broadcast3.imageUrl, 'foo.png')
  t.is(broadcast3.createdAt, broadcast3TS)
})