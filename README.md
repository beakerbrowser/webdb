# WebDB

A database which reads and writes records on dat:// websites. [How it works](#how-it-works)

#### Example

Instantiate:

```js
// in the browser
const WebDB = require('beaker-webdb')
var webdb = new WebDB()

// in nodejs
const DatArchive = require('node-dat-archive')
const WebDB = require('beaker-webdb')
var webdb = new WebDB('./webdb', {DatArchive})
```

Define your schema:

```js
webdb.define('people', {
  // the schema that objects must match
  // (uses JSONSchema v6)
  schema: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      },
      lastName: {
        type: 'string'
      },
      age: {
        description: 'Age in years',
        type: 'integer',
        minimum: 0
      }
    },
    required: ['firstName', 'lastName']
  },

  // secondary indexes for fast queries (optional)
  index: ['lastName', 'lastName+firstName', 'age']
})
```

Then open the DB:

```js
await webdb.open()
```

Next we add source archives to be indexed. The source archives are persisted in IndexedDB/LevelDB, so this doesn't have to be done every run.

```js
await webdb.people.addSource(alicesUrl, {
  filePattern: '/people/*.json'
})
await webdb.people.addSource(bobsUrl, {
  filePattern: '/person.json'
})
await webdb.people.addSource(carlasUrl, {
  filePattern: [
    '/person.json',
    '/people/*.json'
  ]
})
```

Now we can begin querying the database for records.

```js
// get any person record where lastName === 'Roberts'
var mrRoberts = await webdb.people.get('lastName', 'Roberts')

// get any person record named Bob Roberts
var mrRoberts = await webdb.people.get('lastName+firstName', ['Roberts', 'Bob'])

// get all person records with the 'Roberts' lastname
var robertsFamily = await webdb.people
  .where('lastName')
  .equalsIgnoreCase('roberts')
  .toArray()

// get all person records with the 'Roberts' lastname
// and a firstname that starts with 'B'
// - this uses a compound index
var robertsFamilyWithaBName = await webdb.broadcasts
  .where('lastName+firstName')
  .between(['Roberts', 'b'], ['Roberts', 'b\uffff'])
  .toArray()

// get all person records on a given origin
// - origin is an auto-generated attribute
var personsOnBobsSite = await webdb.people
  .where('origin')
  .equals(bobsSiteUrl)
  .toArray()

// get the 30 oldest people indexed
var oldestPeople = await webdb.people
  .orderBy('age')
  .reverse() // oldest first
  .limit(30)
  .toArray()

// count the # of young people
var oldestPeople = await webdb.people
  .where('age')
  .belowOrEqual(18)
  .count()
```

We can also use WebDB to create, modify, and delete records (and their matching files).

```js
// set the record
await webdb.people.put(bobsUrl + '/person.json', {
  firstName: 'Bob',
  lastName: 'Roberts',
  age: 31
})

// update the record if it exists
await webdb.people.update(bobsUrl + '/person.json', {
  age: 32
})

// update or create the record
await webdb.people.upsert(bobsUrl + '/person.json', {
  age: 32
})

// delete the record
await webdb.people.delete(bobsUrl + '/person.json')

// update the spelling of all Roberts records
await webdb.people
  .where('lastName')
  .equals('Roberts')
  .update({lastName: 'Robertos'})

// increment the age of all people under 18
var oldestPeople = await webdb.people
  .where('age')
  .belowOrEqual(18)
  .update(record => {
    record.age = record.age + 1
  })

// delete the 30 oldest people
var oldestPeople = await webdb.people
  .orderBy('age')
  .reverse() // oldest first
  .limit(30)
  .delete()
```

## TODOs

WebDB is still in development.

 - [ ] More efficient key queries (currently loads full record from disk - could just load the keys)
 - [ ] Support for .or() queries

## API reference

### Class: WebDB

#### new WebDB([name])

 - `name` String. Defaults to `'webdb'`. If run in the browser, this will be the name of the IndexedDB instance. If run in NodeJS, this will be the path of the LevelDB folder.

Example:

```js
var webdb = new WebDB('mydb')
```

#### WebDB.delete([name])

 - `name` String. Defaults to `'webdb'`. If run in the browser, this will be the name of the IndexedDB instance. If run in NodeJS, this will be the path of the LevelDB folder.
 - Returns Promise<Void>.

Example:

```js
await WebDB.delete('mydb')
```

### Instance: WebDB

#### webdb.open()

 - Returns Promise<Void>.

Example:

```js
await webdb.open()
```

#### webdb.close()

 - Returns Promise<Void>.

Example:

```js
await webdb.close()
```

#### webdb.define(name, definition)

 - `name` String. The name of the table.
 - `definition` Object.
   - `schema` Object. A [JSON Schema v6](http://json-schema.org/) definition.
   - `index` Array<String>. A list of attributes which should have secondary indexes produced for querying. Each `index` value is a keypath (see https://www.w3.org/TR/IndexedDB/#dfn-key-path).
 - Returns Void.

Create a new table on the `webdb` object.
The table will be set at `webdb.{name}` and be the `WebDBTable` type.

You can specify compound indexes with a `+` separator in the keypath.
You can also index each value of an array using the `*` sigil at the start of the name.
Some example index definitions:

```
one index               - index: 'firstName' 
two indexes             - index: ['firstName', 'lastName']
add a compound index    - index: ['firstName', 'lastName', 'firstName+lastName']
index an array's values - index: ['firstName', '*favoriteFruits']
```

Example:

```js
webdb.define('people', {
  // the schema that objects must match
  // (uses JSONSchema v6)
  schema: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      },
      lastName: {
        type: 'string'
      },
      age: {
        description: 'Age in years',
        type: 'integer',
        minimum: 0
      }
    },
    required: ['firstName', 'lastName']
  },

  // secondary indexes for fast queries (optional)
  index: ['lastName', 'lastName+firstName', 'age']
})
await webdb.open()
// the new table will be defined at webdb.people
```

#### webdb.addSource(url[, options])

 - `url` String or DatArchive or Array<String or DatArchive>. The sites to index.
 - `options` Object.
   - `filePattern` String or Array<String>. An [anymatch](https://www.npmjs.com/package/anymatch) list of files to index.
 - Returns Promise<Void>.

Example:

```js
await webdb.people.addSource('dat://foo.com', {
  filePattern: [
    '/myrecord.json',
    '/myrecords/*.json'
  ]
})
```

#### webdb.removeSource(url)

 - `url` String or DatArchive. The site to deindex.
 - Returns Promise<Void>.

Example:

```js
await webdb.mytable.removeSource('dat://foo.com')
```

#### webdb.listSources()

 - Returns Promise<String>.

Example:

```js
var urls = await webdb.mytable.listSources()
```

#### Event: 'open'

#### Event: 'open-failed'

 - `error` Error.

#### Event: 'versionchange'

#### Event: 'indexes-updated'

 - `url` String. The site that was updated.
 - `version` Number. The version which was updated to.

### Instance: WebDBTable

#### count()

 - Returns Promise<Number>.

Count the number of records in the table.

Example:

```js
var n = await webdb.mytable.count()
```

#### delete(url)

 - Returns Promise<Void>.

Delete the record at the given URL.

Example:

```js
await webdb.mytable.delete('dat://foo.com/bar.json')
```

#### each(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise<Void>.

Iterate over all records in the table with the given function.

Example:

```js
await webdb.mytable.each(record => {
  console.log(record)
})
```

#### filter(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

Start a new query and apply the given filter function to the resultset.

Example:

```js
var records = await webdb.mytable.filter(record => {
  return (record.foo == 'bar')
})
```

#### get(url)

 - `url` String. The URL of the record to fetch.
 - Returns Promise<Object>.

Get the record at the given URL.

Example:

```js
var record = await webdb.mytable.get('dat://foo.com/myrecord.json')
```

#### get(key, value)

 - `key` String. The keyname to search against.
 - `value` Any. The value to match against.
 - Promise<Object>.

Example:

```js
var record = await webdb.mytable.get('foo', 'bar')
```

#### isRecordFile(url)

 - `url` String.
 - Returns Boolean.

Example:

```js
var isRecord = webdb.mytable.isRecordFile('dat://foo.com/myrecord.json')
```

#### limit(n)

 - `n` Number.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.limit(10)
```

#### listRecordFiles(url)

 - `url` String.
 - Returns Promise<Array<Object>>. On each object:
   - `recordUrl` String.
   - `table` WebDBTable.

Example:

```js
var recordFiles = await webdb.mytable.listRecordFiles('dat://foo.com')
```

#### name

 - String.

The name of the table.

#### offset(n)

 - `n` Number.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.offset(5)
```

#### orderBy(key)

 - `key` String.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.orderBy('foo')
```

#### put(url, record)

 - `url` String.
 - `record` Object.
 - Returns Promise<Void>.

Example:

```js
await webdb.mytable.put('dat://foo.com/myrecord.json', {foo: 'bar'})
```

#### query()

 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query()
```

#### reverse()

 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.reverse()
```

#### schema

 - Object.

The schema definition for the table.

#### toArray()

 - Returns Promise<Array>.

Example:

```js
var records = await webdb.mytable.toArray()
```

#### update(url, updates)

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - Returns Promise<Boolean>.

Example:

```js
var wasUpdated = await webdb.mytable.update('dat://foo.com/myrecord.json', {foo: 'bar'})
```

#### update(url, fn)

 - `url` String. The record to update.
 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise<Boolean>.

Example:

```js
var wasUpdated = await webdb.mytable.update('dat://foo.com/myrecord.json', record => {
  record.foo = 'bar'
  return record
})
```

#### upsert(url, updates)

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - Returns Promise<Boolean>.

Example:

```js
var didCreateNew = await webdb.mytable.upsert('dat://foo.com/myrecord.json', {foo: 'bar'})
```

#### where(key)

 - `key` String.
 - Returns IngestWhereClause.

Example:

```js
var whereClause = webdb.mytable.where('foo')
```

#### Event: 'index-updated'

 - `url` String. The site that was updated.
 - `version` Number. The version which was updated to.

Example:

```js
webdb.mytable.on('index-updated', (url, version) => {
  console.log('Table was updated for', url, 'at version', version)
})
```

### Instance: WebDBQuery

#### clone()

 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().clone()
```

#### count()

 - Returns Promise<Number>. The number of found records.

Example:

```js
var numRecords = await webdb.mytable.query().count()
```

#### delete()

 - Returns Promise<Number>. The number of deleted records.

Example:

```js
var numDeleted = await query.delete()
```

#### each(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise<Void>.

Example:

```js
await webdb.mytable.query().each(record => {
  console.log(record)
})
```

#### eachKey(fn)

 - `fn` Function.
   - `key` String.
   - Returns Void.
 - Returns Promise<Void>.

Gives the value of the query's primary key for each matching record.

Example:

```js
await webdb.mytable.query().eachKey(url => {
  console.log('URL =', url)
})
```

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

Example:

```js
await webdb.mytable.orderBy('age').eachKey(age => {
  console.log('Age =', age)
})
```

#### eachUrl(fn)

 - `fn` Function.
   - `url` String.
   - Returns Void.
 - Returns Promise<Void>.

Gives the URL of each matching record.

Example:

```js
await webdb.mytable.query().eachUrl(url => {
  console.log('URL =', url)
})
```

#### filter(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().filter(record => {
  return record.foo == 'bar'
})
```

#### first()

 - Returns Promise<Object>.

Example:

```js
var record = await webdb.mytable.query().first()
```

#### keys()

 - Returns Promise<Array<String>>.

Example:

```js
var keys = await webdb.mytable.query().keys()
```

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

Example:

```js
var ages = await webdb.mytable.orderBy('age').keys()
```

#### last()

 - Returns Promise<Object>.

Example:

```js
var record = await webdb.mytable.query().last()
```

#### limit(n)

 - `n` Number.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().limit(10)
```

#### offset(n)

 - `n` Number.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().offset(10)
```

#### orderBy(key)

 - `key` String.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().orderBy('foo')
```

#### put(record)

 - `record` Object.
 - Returns Promise<Number>. The number of written records.

Example:

```js
var numWritten = await webdb.mytable.query().put({foo: 'bar'})
```

#### urls()

 - Returns Promise<Array<String>>.

Example:

```js
var urls = await webdb.mytable.query().urls()
```

#### reverse()

 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().reverse()
```

#### toArray()

 - Returns Promise<Array<Object>>.

Example:

```js
var records = await webdb.mytable.query().toArray()
```

#### uniqueKeys()

 - Returns Promise<Array<String>>.

Example:

```js
var keys = await webdb.mytable.query().uniqueKeys()
```

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

Example:

```js
var ages = await webdb.mytable.orderBy('age').uniqueKeys()
```

#### until(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

#### update(updates)

 - `updates` Object. The new values to set on the record.
 - Returns Promise<Number>. The number of updated records.

Example:

```js
var numUpdated = await webdb.mytable.query().update({foo: 'bar'})
```

#### update(fn)

 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise<Number>. The number of updated records.

Example:

```js
var numUpdated = await webdb.mytable.query().update(record => {
  record.foo = 'bar'
  return record
})
```

#### where(key)

 - `key` String. The attribute to query against.
 - Returns IngestWhereClause.

Example:

```js
var whereClause = webdb.mytable.query().where('foo')
```

### Instance: WebDBWhereClause

#### above(value)

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').above('bar')
var query = webdb.mytable.query().where('age').above(18)
```

#### aboveOrEqual(value)

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').aboveOrEqual('bar')
var query = webdb.mytable.query().where('age').aboveOrEqual(18)
```

#### anyOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').anyOf(['bar', 'baz'])
```

#### anyOfIgnoreCase(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').anyOfIgnoreCase(['bar', 'baz'])
```

#### below(value)

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').below('bar')
var query = webdb.mytable.query().where('age').below(18)
```

#### belowOrEqual(value)

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').belowOrEqual('bar')
var query = webdb.mytable.query().where('age').belowOrEqual(18)
```

#### between(lowerValue, upperValue[, options])

 - `lowerValue` Any.
 - `upperValue` Any.
 - `options` Object.
   - `includeUpper` Boolean.
   - `includeLower` Boolean.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').between('bar', 'baz', {includeUpper: true, includeLower: true})
var query = webdb.mytable.query().where('age').between(18, 55, {includeLower: true})
```

#### equals(value)

 - `value` Any.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').equals('bar')
```

#### equalsIgnoreCase(value)

 - `value` Any.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').equalsIgnoreCase('bar')
```

#### noneOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').noneOf(['bar', 'baz'])
```

#### notEqual(value)

 - `value` Any.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').notEqual('bar')
```

#### startsWith(value)

 - `value` Any.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').startsWith('ba')
```

#### startsWithAnyOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').startsWithAnyOf(['ba', 'bu'])
```

#### startsWithAnyOfIgnoreCase(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').startsWithAnyOfIgnoreCase(['ba', 'bu'])
```

#### startsWithIgnoreCase(value)

 - `value` Any.
 - Returns WebDBQuery.

Example:

```js
var query = webdb.mytable.query().where('foo').startsWithIgnoreCase('ba')
```


## How it works

WebDB abstracts over the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html) to provide a simple database-like interface. It is inspired by [Dexie.js](https://github.com/dfahlander/Dexie.js) and built using LevelDB. (In the browser, it runs on IndexedDB using [level.js](https://github.com/maxogden/level.js).

WebDB works by scanning a set of source archives for files that match a path pattern. Those files are indexed ("ingested") so that they can be queried easily. WebDB also provides a simple interface for adding, editing, and removing records on the archives that the local user owns.

WebDB sits on top of Dat archives. It duplicates the data it's handling into IndexedDB, and that duplicated data acts as a throwaway cache -- it can be reconstructed at any time from the Dat archives.

WebDB treats individual files in the Dat archive as individual records in a table. As a result, there's a direct mapping for each table to a folder of .json files. For instance, if you had a 'tweets' table, it would map to the `/tweets/*.json` files. WebDB's mutators, such as put or add or update, simply write those json files. WebDB's readers & query-ers, such as get() or where(), read from the IndexedDB cache.

WebDB watches its source archives for changes to the json files. When they change, it reads them and updates IndexedDB, thus the query results stay up-to-date. The flow is, roughly: `put() -> archive/tweets/12345.json -> indexer -> indexeddb -> get()`.