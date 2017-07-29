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
      await write('/multi/1.json', {first: 'first' + i, second: (i+1)*100, third: 'third' + i + 'multi1'})
      await write('/multi/2.json', {first: 'first' + i, second: i, third: 'third' + i + 'multi2'})
      await write('/multi/3.json', {first: 'first' + (i+1)*100, second: i, third: 'third' + i + 'multi3'})
    }))
  }
})

test('each()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  await testDB.single.getRecordSet().each(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.getRecordSet().each(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 30)
  await testDB.close()
})

test('toArray()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  var results = await testDB.single.getRecordSet().toArray()
  results.forEach(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  results = await testDB.multi.getRecordSet().toArray()
  results.forEach(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 30)
  await testDB.close()
})

test('eachKey()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  await testDB.single.getRecordSet().eachKey(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.getRecordSet().eachKey(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .first
    t.truthy(result.startsWith('first'))
  })
  t.is(n, 30)
  await testDB.close()
})

test('keys()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  var keys = await testDB.single.getRecordSet().keys()
  keys.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  var keys = await testDB.multi.getRecordSet().keys()
  keys.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .first
    t.truthy(result.startsWith('first'))
  })
  t.is(n, 30)
  await testDB.close()
})

test('eachUrl()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  await testDB.single.getRecordSet().eachUrl(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.getRecordSet().eachUrl(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 30)
  await testDB.close()
})

test('urls()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  var urls = await testDB.single.getRecordSet().urls()
  urls.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  urls = await testDB.multi.getRecordSet().urls()
  urls.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is ._url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 30)
  await testDB.close()
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

test('last()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.getRecordSet().last()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  result = await testDB.multi.getRecordSet().last()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  await testDB.close()
})

test('count()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.getRecordSet().count()
  t.is(result, 10)
  result = await testDB.multi.getRecordSet().count()
  t.is(result, 30)
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
  result = await testDB.single.getRecordSet().reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.single.orderBy('second').reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.multi.getRecordSet().reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.multi.orderBy('second').reverse().toArray()
  t.truthy(result[0].first, 'first9')
  await testDB.close()
})

test('distinct()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.getRecordSet().distinct().count()
  t.is(result, 10)
  result = await testDB.multi.getRecordSet().distinct().count()
  t.is(result, 30)
  result = await testDB.multi.orderBy('second').distinct().count()
  t.is(result, 20)
  await testDB.close()
})

test('uniqueKeys()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.getRecordSet().uniqueKeys()
  t.is(result.length, 10)
  result = await testDB.multi.getRecordSet().uniqueKeys()
  t.is(result.length, 20)
  await testDB.close()
})

test('offset() and limit()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.orderBy('first').offset(1).toArray()
  t.is(results[0].first, 'first1')
  t.is(results.length, 9)
  var results = await testDB.single.orderBy('first').limit(2).toArray()
  t.is(results[0].first, 'first0')
  t.is(results[1].first, 'first1')
  t.is(results.length, 2)
  var results = await testDB.single.orderBy('first').offset(1).limit(2).toArray()
  t.is(results[0].first, 'first1')
  t.is(results[1].first, 'first2')
  t.is(results.length, 2)
  var results = await testDB.single.orderBy('first').offset(1).limit(2).reverse().toArray()
  t.is(results[0].first, 'first8')
  t.is(results[1].first, 'first7')
  t.is(results.length, 2)
  await testDB.close()
})


test('filter()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.filter(r => r.first === 'first5').toArray()
  t.is(results[0].first, 'first5')
  t.is(results.length, 1)
  await testDB.close()
})

test('until()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.orderBy('first').until(r => r.first === 'first5').toArray()
  t.is(results[0].first, 'first0')
  t.is(results[5].first, 'first5')
  t.is(results.length, 6)
  await testDB.close()
})

test('or()', async t => {
  // TODO
  t.pass()
})

test('update()', async t => {
  // TODO
  t.pass()
})

test('delete()', async t => {
  // TODO
  t.pass()
})

test('clone()', async t => {
  var result
  const testDB = await setupNewDB()
  var resultSet = testDB.single.orderBy('first')
  var resultSetClone = resultSet.clone().reverse()
  result = await resultSet.first()
  t.is(result.first, 'first0')
  result = await resultSetClone.first()
  t.is(result.first, 'first9')
  await testDB.close()
})
