const test = require('ava')
const path = require('path')
const fs = require('fs')
const {newDB, reopenDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')
const Ajv = require('ajv')

test.before(() => console.log('indexer.js'))

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

test('index an archive', async t => {
  t.plan(27)

  // index the archive
  var testDB = await setupNewDB()

  // test the source-indexing event
  testDB.on('source-indexing', (url, startVersion, targetVersion) => {
    t.is(url, aliceArchive.url)
    t.is(startVersion, 0)
    t.is(targetVersion, 7)
  })

  testDB.on('source-index-progress', (url, tick, total) => {
    t.truthy(tick <= 5)
    t.is(total, 5)
    t.is(url, aliceArchive.url)
  })

  // test the put event
  testDB.profile.on('put-record', ({url, origin, record}) => {
    t.deepEqual(url, `${aliceArchive.url}/profile.json`)
    t.deepEqual(origin, aliceArchive.url)
    t.deepEqual(record, {
      name: 'alice',
      bio: 'Cool computer girl',
      avatarUrl: 'alice.png'
    })
  })

  // test the source-indexed event
  testDB.on('source-indexed', (url, targetVersion) => {
    t.is(url, aliceArchive.url)
    t.is(targetVersion, 7)
  })

  await testDB.indexArchive(aliceArchive)

  // test the indexed values
  await testAliceIndex(t, testDB)

  await testDB.close()
})

test('handle indexing failures', async t => {
  t.plan(8)

  // index the archive
  var testDB = await setupNewDB()

  // test the put event
  testDB.profile.on('put-record', ({url, origin, record}) => {
    t.deepEqual(url, `${aliceArchive.url}/profile.json`)
    t.deepEqual(origin, aliceArchive.url)
    t.deepEqual(record, {
      name: 'alice',
      bio: 'Cool computer girl',
      avatarUrl: 'alice.png'
    })
  })

  // setup reads to fail
  let readFile = aliceArchive.readFile
  aliceArchive.readFile = () => { throw new Error('Failed to read') }

  // try indexing (should fail)
  await testDB.indexArchive(aliceArchive)

  // no data
  await t.throws(testDB.profile.level.get(aliceArchive.url + '/profile.json'))

  // restore reads
  aliceArchive.readFile = readFile

  // // try indexing (should succeed)
  await testDB.indexArchive(aliceArchive)

  // // test the indexed values
  await testAliceIndex(t, testDB)

  await testDB.close()
})

test('index two archives', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await Promise.all([
    testDB.indexArchive(aliceArchive),
    testDB.indexArchive(bobArchive)
  ])

  // test the indexed values
  await testAliceIndex(t, testDB)
  await testBobIndex(t, testDB)

  await testDB.close()
})

test('index, delete db, then reindex', async t => {
  var testDB = await setupNewDB()

  // index the archive
  await testDB.indexArchive(aliceArchive)
  await testAliceIndex(t, testDB)

  // delete db
  await testDB.delete()
  await testDB.open()

  // index the archive
  await testDB.indexArchive(aliceArchive)
  await testAliceIndex(t, testDB)

  await testDB.close()
})

test('make schema changes that require a full rebuild', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await Promise.all([
    testDB.indexArchive(aliceArchive),
    testDB.indexArchive(bobArchive)
  ])

  // test the indexed values
  await testAliceIndex(t, testDB)
  await testBobIndex(t, testDB)

  // grab counts
  var profileCount = await testDB.profile.count()
  var broadcastsCount = await testDB.broadcasts.count()
  t.is(profileCount, 2)
  t.truthy(broadcastsCount > 0)

  // close, make destructive change, and reopen
  await testDB.close()
  const testDB2 = reopenDB(testDB)
  testDB2.define('profile', {
    filePattern: '/profile.json',
    index: ['name', 'bio'],
    validate: (new Ajv()).compile({
      type: 'object',
      properties: {
        name: {type: 'string'},
        bio: {type: 'string'}
      },
      required: ['name']
    })
  })
  testDB2.define('broadcasts', {
    filePattern: '/broadcasts/*.json',
    index: ['createdAt', 'type', 'type+createdAt'],
    validate: (new Ajv()).compile({
      type: 'object',
      properties: {
        type: {type: 'string'},
        createdAt: {type: 'number'}
      },
      required: ['type', 'createdAt']
    })
  })
  var res = await testDB2.open()
  t.deepEqual(res, {rebuilds: ['profile', 'broadcasts']})
  await Promise.all([
    testDB2.indexArchive(aliceArchive),
    testDB2.indexArchive(bobArchive)
  ])

    // test the indexed values
  // await testAliceIndex(t, testDB2)
  // await testBobIndex(t, testDB2)

  // check counts
  t.is(profileCount, await testDB2.profile.count())
  t.is(broadcastsCount, await testDB2.broadcasts.count())
  await testDB2.close()
})

test('index two archives, then make changes', async t => {
  // index the archive
  var testDB = await setupNewDB()
  await Promise.all([
    testDB.indexArchive(aliceArchive),
    testDB.indexArchive(bobArchive)
  ])

  // test the indexed values
  await testAliceIndex(t, testDB)
  await testBobIndex(t, testDB)

  testDB.on('source-indexing', (url, startVersion, targetVersion) => {
    t.is(url, aliceArchive.url)
    t.is(typeof startVersion, 'number')
    t.is(typeof targetVersion, 'number')
    t.truthy(startVersion <= targetVersion)
  })
  testDB.on('source-index-progress', (url, tick, total) => {
    t.is(tick, 1)
    t.is(total, 1)
    t.is(url, aliceArchive.url)
  })
  testDB.on('source-indexed', (url, targetVersion) => {
    t.is(url, aliceArchive.url)
    t.is(typeof targetVersion, 'number')
  })

  // write changes to alice's profile.json
  await aliceArchive.writeFile('/profile.json', JSON.stringify({name: 'alice', bio: '_Very_ cool computer girl'}))
  await new Promise(resolve => testDB.once('indexes-updated', resolve))

  // test updated values
  var profile = await testDB.profile.level.get(aliceArchive.url + '/profile.json')
  t.truthy(profile)
  t.is(profile.record.name, 'alice')
  t.is(profile.record.bio, '_Very_ cool computer girl')

  // add a new broadcast to alice
  aliceArchive.broadcast4TS = ts()
  await aliceArchive.writeFile(`/broadcasts/${aliceArchive.broadcast4TS}.json`, JSON.stringify({type: 'comment', text: 'Index me!', createdAt: aliceArchive.broadcast4TS}))
  await new Promise(resolve => testDB.once('indexes-updated', resolve))

  // test updated values
  var broadcast4 = await testDB.broadcasts.level.get(aliceArchive.url + `/broadcasts/${aliceArchive.broadcast4TS}.json`)
  t.truthy(broadcast4)
  t.is(broadcast4.record.type, 'comment')
  t.is(broadcast4.record.text, 'Index me!')
  t.is(broadcast4.record.createdAt, aliceArchive.broadcast4TS)

  // delete broadcast 1 from alice
  await aliceArchive.unlink(`/broadcasts/${aliceArchive.broadcast1TS}.json`)
  await new Promise(resolve => testDB.once('indexes-updated', resolve))

  // test updated values
  try {
    var broadcast4 = await testDB.broadcasts.level.get(aliceArchive.url + `/broadcasts/${aliceArchive.broadcast1TS}.json`)
    t.fail('should not hit')
  } catch (e) {
    t.truthy(e)
  }

  await testDB.close()
})

test('catch errors when validating records', async t => {
  // fail if assertion is not made
  t.plan(1)
  var testDB = await setupNewDB()

  // when 'source-error' triggers, assert the error we are looking for
  testDB.on('validation-failed', (url, e) => {
      t.true(e.message.indexOf('undefinedFunc is not defined') > -1)
  })

  // set validate to something that will fail
  testDB.profile.schema.validate = function() { undefinedFunc() }

  // index archive, which should trigger faulty validator
  await testDB.indexArchive(aliceArchive)

  await testDB.close()
})

async function testAliceIndex (t, testDB) {
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
  var broadcast3 = await testDB.broadcasts.level.get(aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast3TS + '.json')
  t.deepEqual(broadcast3, {
    url: aliceArchive.url + '/broadcasts/' + aliceArchive.broadcast3TS + '.json',
    origin: aliceArchive.url,
    indexedAt: broadcast3.indexedAt,
    record: {
      type: 'image',
      imageUrl: 'foo.png',
      createdAt: aliceArchive.broadcast3TS
    }
  })
}

async function testBobIndex (t, testDB) {
  var profile = await testDB.profile.level.get(bobArchive.url + '/profile.json')
  t.deepEqual(profile, {
    url: bobArchive.url + '/profile.json',
    origin: bobArchive.url,
    indexedAt: profile.indexedAt,
    record: {
      avatarUrl: 'alice.png',
      name: 'bob',
      bio: 'Cool computer guy'
    }
  })
  var broadcast1 = await testDB.broadcasts.level.get(bobArchive.url + '/broadcasts/' + bobArchive.broadcast1TS + '.json')
  t.deepEqual(broadcast1, {
    url: bobArchive.url + '/broadcasts/' + bobArchive.broadcast1TS + '.json',
    origin: bobArchive.url,
    indexedAt: broadcast1.indexedAt,
    record: {
      type: 'comment',
      text: 'Hello, world!',
      createdAt: bobArchive.broadcast1TS
    }
  })
  var broadcast2 = await testDB.broadcasts.level.get(bobArchive.url + '/broadcasts/' + bobArchive.broadcast2TS + '.json')
  t.deepEqual(broadcast2, {
    url: bobArchive.url + '/broadcasts/' + bobArchive.broadcast2TS + '.json',
    origin: bobArchive.url,
    indexedAt: broadcast2.indexedAt,
    record: {
      type: 'image',
      imageUrl: 'baz.png',
      createdAt: bobArchive.broadcast2TS
    }
  })
}
