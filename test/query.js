const test = require('ava')
const {newDB, ts} = require('./lib/util')
const DatArchive = require('node-dat-archive')
const tempy = require('tempy')

test.before(() => console.log('query.js'))

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
  await testDB.single.query().each(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.query().each(result => {
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
  var results = await testDB.single.query().toArray()
  results.forEach(result => {
    n++
    t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  })
  t.is(n, 10)
  n = 0
  results = await testDB.multi.query().toArray()
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
  await testDB.single.query().eachKey(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.query().eachKey(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 30)
  n = 0
  await testDB.multi.orderBy('second').eachKey(result => {
    n++
    // is .second
    t.truthy(typeof result === 'number')
  })
  t.is(n, 30)
  await testDB.close()
})

test('keys()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  var keys = await testDB.single.query().keys()
  keys.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  var keys = await testDB.multi.query().keys()
  keys.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 30)
  await testDB.close()
})

test('eachUrl()', async t => {
  var n
  var result
  const testDB = await setupNewDB()
  n = 0
  await testDB.single.query().eachUrl(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  await testDB.multi.query().eachUrl(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
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
  var urls = await testDB.single.query().urls()
  urls.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 10)
  n = 0
  urls = await testDB.multi.query().urls()
  urls.forEach(result => {
    n++
    t.truthy(typeof result === 'string')
    // is .url
    t.truthy(result.startsWith('dat://'))
    t.truthy(result.endsWith('.json'))
  })
  t.is(n, 30)
  await testDB.close()
})

test('first()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().first()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  result = await testDB.multi.query().first()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  await testDB.close()
})

test('last()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().last()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  result = await testDB.multi.query().last()
  t.truthy(result && 'first' in result && 'second' in result && 'third' in result)
  await testDB.close()
})

test('count()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().count()
  t.is(result, 10)
  result = await testDB.multi.query().count()
  t.is(result, 30)
  await testDB.close()
})

test('orderBy()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().orderBy('first').first()
  t.is(result.first, 'first0')
  result = await testDB.single.query().orderBy('second').first()
  t.is(result.second, 0)
  result = await testDB.single.query().orderBy('first+second').first()
  t.is(result.first, 'first0')
  t.is(result.second, 0)
  result = await testDB.single.query().orderBy('third').first()
  t.is(result.third, 'third0single')
  result = await testDB.multi.query().orderBy('first').first()
  t.is(result.first, 'first0')
  result = await testDB.multi.query().orderBy('second').first()
  t.is(result.second, 0)
  result = await testDB.multi.query().orderBy('first+second').first()
  t.is(result.first, 'first0')
  t.is(result.second, 0)
  result = await testDB.multi.query().orderBy('third').first()
  t.is(result.third, 'third0multi1')
  await testDB.close()
})

test('reverse()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.single.query().orderBy('second').reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.multi.query().reverse().toArray()
  t.truthy(result[0].first, 'first9')
  result = await testDB.multi.query().orderBy('second').reverse().toArray()
  t.truthy(result[0].first, 'first9')
  await testDB.close()
})

test('uniqueKeys()', async t => {
  var result
  const testDB = await setupNewDB()
  result = await testDB.single.query().uniqueKeys()
  t.is(result.length, 10)
  result = await testDB.multi.query().orderBy('first').uniqueKeys()
  t.is(result.length, 20)
  await testDB.close()
})

test('offset() and limit()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.query().orderBy('first').offset(1).toArray()
  t.is(results[0].first, 'first1')
  t.is(results.length, 9)
  var results = await testDB.single.query().orderBy('first').limit(2).toArray()
  t.is(results[0].first, 'first0')
  t.is(results[1].first, 'first1')
  t.is(results.length, 2)
  var results = await testDB.single.query().orderBy('first').offset(1).limit(2).toArray()
  t.is(results[0].first, 'first1')
  t.is(results[1].first, 'first2')
  t.is(results.length, 2)
  var results = await testDB.single.query().orderBy('first').offset(1).limit(2).reverse().toArray()
  t.is(results[0].first, 'first8')
  t.is(results[1].first, 'first7')
  t.is(results.length, 2)
  await testDB.close()
})

test('filter()', async t => {
  const testDB = await setupNewDB()
  var results = await testDB.single.query().filter(r => r.first === 'first5').toArray()
  t.is(results[0].first, 'first5')
  t.is(results.length, 1)
  var results = await testDB.single.query()
    .filter(r => r.first.startsWith('first'))
    .filter(r => r.second === 5)
    .toArray()
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
