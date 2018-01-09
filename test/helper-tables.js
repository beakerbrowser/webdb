const test = require('ava')
const {newDB} = require('./lib/util')
const tempy = require('tempy')

test.before(() => console.log('helper-tables.js'))

var archives = []

async function setupNewDB () {
  const testDB = newDB()
  testDB.define('helper', {
    helperTable: true,
    index: ['color', 'height']
  })
  await testDB.open()
  return testDB
}

test('put(), get(), and delete()', async t => {
  const testDB = await setupNewDB()

  await testDB.helper.put('thing1', {color: 'blue', height: 5, width: 2})
  await testDB.helper.put('thing2', {color: 'red', height: 6, width: 1})
  await testDB.helper.put('thing3', {color: 'blue', height: 2, width: 2})

  t.deepEqual(getObjData(await testDB.helper.get('thing1')), {color: 'blue', height: 5, width: 2})
  t.deepEqual(getObjData(await testDB.helper.get('thing2')), {color: 'red', height: 6, width: 1})
  t.deepEqual(getObjData(await testDB.helper.get('thing3')), {color: 'blue', height: 2, width: 2})

  t.deepEqual(getObjData(await testDB.helper.get('color', 'red')), {color: 'red', height: 6, width: 1})
  t.deepEqual(getObjData(await testDB.helper.get('height', 2)), {color: 'blue', height: 2, width: 2})

  await testDB.helper.delete('thing3')
  t.deepEqual(await testDB.helper.get('thing3'), undefined)
  t.deepEqual(await testDB.helper.get('height', 2), undefined)
})

test('queries', async t => {
  const testDB = await setupNewDB()

  await testDB.helper.put('thing1', {color: 'blue', height: 5, width: 2})
  await testDB.helper.put('thing2', {color: 'red', height: 6, width: 1})
  await testDB.helper.put('thing3', {color: 'blue', height: 2, width: 2})

  t.deepEqual(getObjData(await testDB.helper.where('color').equals('blue').first()), {color: 'blue', height: 5, width: 2})
  t.deepEqual(getObjData((await testDB.helper.where('color').equalsIgnoreCase('RED').toArray())[0]), {color: 'red', height: 6, width: 1})
  t.deepEqual(getObjData(await testDB.helper.orderBy('color').offset(1).first()), {color: 'blue', height: 2, width: 2})

  await testDB.helper.where('color').equals('blue').update({color: 'BLUE'})
  await testDB.helper.orderBy('height').update(record => { record.height = record.height + 1; return record })

  t.deepEqual(getObjData(await testDB.helper.get('thing1')), {color: 'BLUE', height: 6, width: 2})
  t.deepEqual(getObjData(await testDB.helper.get('thing2')), {color: 'red', height: 7, width: 1})
  t.deepEqual(getObjData(await testDB.helper.get('thing3')), {color: 'BLUE', height: 3, width: 2})
})

function getObjData (obj) {
  for (var k in obj) {
    if (typeof obj[k] === 'function') {
      delete obj[k]
    }
  }
  return obj
}