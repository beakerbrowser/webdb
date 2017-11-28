const test = require('ava')
const level = require('memdb')
const sub = require('level-sublevel')
const getStream = require('get-stream')
const IndexedLevel = require('../lib/indexed-level.js')

test.before(() => console.log('indexed-level.js'))

test('indexes', async t => {
  const db = IndexedLevel(sub(level({ valueEncoding: 'json'})), [
    'lastName',
    'lastName+firstName',
    '*attributes',
  ])

  const PAUL = {firstName: 'Paul', lastName: 'Frazee', attributes: ['ginger', 'hacker']}
  const JACK = {firstName: 'Jack', lastName: 'Frazee', attributes: ['ginger', 'lawyer']}
  const TARA = {firstName: 'Tara', lastName: 'Vancil', attributes: ['brunette', 'hacker']}

  await db.put(1, PAUL)
  await db.put(2, JACK)
  await db.put(3, TARA)

  // test all getters

  t.deepEqual(await db.get(1), PAUL)
  t.deepEqual(await db.get(2), JACK)
  t.deepEqual(await db.get(3), TARA)

  t.deepEqual(await db.indexes.lastName.get('Frazee'), PAUL)
  t.deepEqual(await db.indexes.lastName.get('Vancil'), TARA)

  t.deepEqual(await db.indexes['lastName+firstName'].get(['Frazee', 'Paul']), PAUL)
  t.deepEqual(await db.indexes['lastName+firstName'].get(['Frazee', 'Jack']), JACK)
  t.deepEqual(await db.indexes['lastName+firstName'].get(['Vancil', 'Tara']), TARA)

  t.deepEqual(await db.indexes.attributes.get('hacker'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('ginger'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('brunette'), TARA)

  // test normal stream behavior

  t.deepEqual(await getStream.array(db.createReadStream()), [{key: '1', value: PAUL}, {key: '2', value: JACK}, {key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2})), [{key: '2', value: JACK}, {key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2, lt: 3})), [{key: '2', value: JACK}])

  t.deepEqual(await getStream.array(db.createKeyStream()), ['1', '2', '3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2})), ['2', '3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2, lt: 3})), ['2'])

  t.deepEqual(await getStream.array(db.createValueStream()), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2})), [JACK, TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2, lt: 3})), [JACK])

  // test index stream behavior

  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream()), [{key: 1, value: PAUL}, {key: 2, value: JACK}, {key: 3, value: TARA}])
  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream({gt: 'Frazee'})), [{key: 3, value: TARA}])

  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream()), [1, 2, 3])
  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream({gt: 'Frazee'})), [3])

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream()), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee'})), [TARA])

  // test index ranges

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee'})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({lte: 'Frazee'})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lte: 'Vancil'})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee', lte: 'Vancil'})), [TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lt: 'Vancil'})), [PAUL, JACK])

  // test compound index ranges

  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee']})), [JACK, PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee']})), [])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee', 'Jack']})), [JACK])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lt: ['Frazee', 'Jack']})), [])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lte: ['Vancil']})), [JACK, PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil']})), [JACK, PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil', 'Tara']})), [JACK, PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lt: ['Vancil']})), [JACK, PAUL])

  // test multiple index ranges

  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'hacker', lte: 'hacker'})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'ginger', lte: 'ginger'})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'brunette', lte: 'brunette'})), [TARA])

  // test modifications

  JACK.attributes.push('hacker')
  JACK.attributes.push('houstonian')
  JACK.lastName = 'Frazee-Walthall'
  await db.put(2, JACK)

  // test all getters

  t.deepEqual(await db.indexes.lastName.get('Frazee'), PAUL)
  t.deepEqual(await db.indexes.lastName.get('Frazee-Walthall'), JACK)
  t.deepEqual(await db.indexes.lastName.get('Vancil'), TARA)

  t.deepEqual(await db.indexes['lastName+firstName'].get(['Frazee', 'Paul']), PAUL)
  t.deepEqual(await db.indexes['lastName+firstName'].get(['Frazee-Walthall', 'Jack']), JACK)
  t.deepEqual(await db.indexes['lastName+firstName'].get(['Vancil', 'Tara']), TARA)

  t.deepEqual(await db.indexes.attributes.get('hacker'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('ginger'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('brunette'), TARA)
  t.deepEqual(await db.indexes.attributes.get('houstonian'), JACK)

  // test normal stream behavior

  t.deepEqual(await getStream.array(db.createReadStream()), [{key: '1', value: PAUL}, {key: '2', value: JACK}, {key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2})), [{key: '2', value: JACK}, {key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2, lt: 3})), [{key: '2', value: JACK}])

  t.deepEqual(await getStream.array(db.createKeyStream()), ['1', '2', '3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2})), ['2', '3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2, lt: 3})), ['2'])

  t.deepEqual(await getStream.array(db.createValueStream()), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2})), [JACK, TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2, lt: 3})), [JACK])

  // test index stream behavior

  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream()), [{key: 1, value: PAUL}, {key: 2, value: JACK}, {key: 3, value: TARA}])
  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream({gt: 'Frazee'})), [{key: 2, value: JACK}, {key: 3, value: TARA}])

  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream()), [1, 2, 3])
  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream({gt: 'Frazee'})), [2, 3])

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream()), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee'})), [JACK, TARA])

  // test index ranges

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee'})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({lte: 'Frazee'})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lte: 'Vancil'})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee', lte: 'Vancil'})), [JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lt: 'Vancil'})), [PAUL, JACK])

  // test compound index ranges

  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee']})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee']})), [])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee-Walthall', 'Jack']})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lt: ['Frazee-Walthall', 'Jack']})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lte: ['Vancil']})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil']})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil', 'Tara']})), [PAUL, JACK, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lt: ['Vancil']})), [PAUL, JACK])

  // test multiple index ranges

  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'hacker', lte: 'hacker'})), [PAUL, TARA, JACK])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'ginger', lte: 'ginger'})), [PAUL, JACK])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'brunette', lte: 'brunette'})), [TARA])

  // test deletions

  await db.del(2)

  // test all getters

  t.deepEqual(await db.indexes.lastName.get('Frazee'), PAUL)
  t.deepEqual(await db.indexes.lastName.get('Vancil'), TARA)

  t.deepEqual(await db.indexes['lastName+firstName'].get(['Frazee', 'Paul']), PAUL)
  t.deepEqual(await db.indexes['lastName+firstName'].get(['Vancil', 'Tara']), TARA)

  t.deepEqual(await db.indexes.attributes.get('hacker'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('ginger'), PAUL)
  t.deepEqual(await db.indexes.attributes.get('brunette'), TARA)

  // test normal stream behavior

  t.deepEqual(await getStream.array(db.createReadStream()), [{key: '1', value: PAUL}, {key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2})), [{key: '3', value: TARA}])
  t.deepEqual(await getStream.array(db.createReadStream({gte: 2, lt: 3})), [])

  t.deepEqual(await getStream.array(db.createKeyStream()), ['1', '3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2})), ['3'])
  t.deepEqual(await getStream.array(db.createKeyStream({gte: 2, lt: 3})), [])

  t.deepEqual(await getStream.array(db.createValueStream()), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2})), [TARA])
  t.deepEqual(await getStream.array(db.createValueStream({gte: 2, lt: 3})), [])

  // test index stream behavior

  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream()), [{key: 1, value: PAUL}, {key: 3, value: TARA}])
  t.deepEqual(await getStream.array(db.indexes.lastName.createReadStream({gt: 'Frazee'})), [{key: 3, value: TARA}])

  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream()), [1, 3])
  t.deepEqual(await getStream.array(db.indexes.lastName.createKeyStream({gt: 'Frazee'})), [3])

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream()), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee'})), [TARA])

  // test index ranges

  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee'})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({lte: 'Frazee'})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lte: 'Vancil'})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gt: 'Frazee', lte: 'Vancil'})), [TARA])
  t.deepEqual(await getStream.array(db.indexes.lastName.createValueStream({gte: 'Frazee', lt: 'Vancil'})), [PAUL])

  // test compound index ranges

  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee']})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee']})), [])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lte: ['Frazee-Walthall', 'Jack']})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({lt: ['Frazee-Walthall', 'Jack']})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lte: ['Vancil']})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil']})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gt: ['Frazee'], lte: ['Vancil', 'Tara']})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee'], lt: ['Vancil']})), [PAUL])

  // test multiple index ranges

  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'hacker', lte: 'hacker'})), [PAUL, TARA])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'ginger', lte: 'ginger'})), [PAUL])
  t.deepEqual(await getStream.array(db.indexes.attributes.createValueStream({gte: 'brunette', lte: 'brunette'})), [TARA])
})
