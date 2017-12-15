const test = require('ava')
const {newDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('table.js'))

var archives = []

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('single', {
    filePattern: '/single.json',
    index: ['first', 'second', 'first+second', 'third']
  })
  testDB.define('multi', {
    filePattern: '/multi/*.json',
    index: ['first', 'second', 'first+second', 'third']
  })
  await testDB.open()
  await testDB.indexArchive(archives)
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

test('count()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.count()
  t.is(result, 10)
  result = await testDB.multi.count()
  t.is(result, 30)
  await testDB.close()
})

test('each()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  await testDB.single.each(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.each(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 30)
  await testDB.close()
})

test('filter()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.filter(r => r.first === 'first5').toArray()
  t.is(results[0].first, 'first5')
  t.is(results.length, 1)
  var results = await testDB.single
    .filter(r => r.first.startsWith('first'))
    .filter(r => r.second === 5)
    .toArray()
  t.is(results[0].first, 'first5')
  t.is(results.length, 1)
  await testDB.close()
})

test('get()', async t => {
  const testDB = await setupNewDB()

  var result = await testDB.single.get(archives[0].url + '/single.json')
  t.is(result.getRecordURL(), archives[0].url + '/single.json')
  t.is(result.getRecordOrigin(), archives[0].url)
  t.is(typeof result.getIndexedAt(), 'number')
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.single.get('first', 'first0')
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.single.get('second', 0)
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.single.get('first+second', ['first0', 0])
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.single.get('first', 'notfound')
  t.falsy(result)

  var result = await testDB.multi.get(archives[0].url + '/multi/1.json')
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.multi.get('first', 'first0')
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.multi.get('second', 0)
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.multi.get('first+second', ['first0', 0])
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  var result = await testDB.multi.get('first', 'notfound')
  t.falsy(result)

  await testDB.close()
})

test('offset() and limit()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.offset(1).toArray()
  t.is(results.length, 9)
  var results = await testDB.single.limit(2).toArray()
  t.is(results.length, 2)
  var results = await testDB.single.offset(1).limit(2).toArray()
  t.is(results.length, 2)
  var results = await testDB.single.offset(1).limit(2).reverse().toArray()
  t.is(results.length, 2)
  await testDB.close()
})

test('orderBy()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.orderBy('first').first()
  t.is(result.first, 'first0')
  result = await testDB.single.orderBy('second').first()
  t.is(result.second, 0)
  result = await testDB.single.orderBy('first+second').first()
  t.is(result.first, 'first0')
  t.is(result.second, 0)
  result = await testDB.single.orderBy('third').first()
  t.is(result.third, 'third0single')
  result = await testDB.multi.orderBy('first').first()
  t.is(result.first, 'first0')
  result = await testDB.multi.orderBy('second').first()
  t.is(result.second, 0)
  result = await testDB.multi.orderBy('first+second').first()
  t.is(result.first, 'first0')
  t.is(result.second, 0)
  result = await testDB.multi.orderBy('third').first()
  t.is(result.third, 'third0multi1')
  await testDB.close()
})

test('reverse()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.multi.reverse().toArray()
  t.truthy(result[0].first, 'first9')
  await testDB.close()
})

test('toArray()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  var results = await testDB.single.toArray()
  results.forEach(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  results = await testDB.multi.toArray()
  results.forEach(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 30)
  await testDB.close()
})
