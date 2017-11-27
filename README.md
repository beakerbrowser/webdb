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

#### WebDB.delete([name])

 - Returns Promise<Void>.

### Instance: WebDB

#### webdb.open()

 - Returns Promise<Void>.

#### webdb.close()

 - Returns Promise<Void>.

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
#### webdb.addSource(urls[, options])

 - `url` String or DatArchive. The site to index.
 - `urls` Array<String or DatArchive>. The sites to index.
 - `options` Object.
   - `filePattern` String or Array<String>. An [anymatch](https://www.npmjs.com/package/anymatch) list of files to index.
 - Returns Promise<Void>.

#### webdb.removeSource(url)

 - `url` String or DatArchive. The site to deindex.
 - Returns Promise<Void>.

#### webdb.listSources()

 - Returns Promise<String>.

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

#### delete(url)

 - Returns Promise<Void>.

#### each(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise<Void>.

#### filter(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

#### get(url)

 - `url` String. The URL of the record to fetch.
 - Returns Promise<Object>.

#### get(key, value)

 - `key` String. The keyname to search against.
 - `value` Any. The value to match against.
 - Promise<Object>.

#### isRecordFile(url)

 - `url` String.
 - Returns Boolean.

#### limit(n)

 - `n` Number.
 - Returns WebDBQuery.

#### listRecordFiles(url)

 - `url` String.
 - Returns Promise<Object>.

#### name

 - String.

The name of the table.

#### offset(n)

 - `n` Number.
 - Returns WebDBQuery.

#### orderBy(key)

 - `key` String.
 - Returns WebDBQuery.

#### put(url, record)

 - `url` String.
 - `record` Object.
 - Returns Promise<Void>.

#### query()

 - Returns WebDBQuery.

#### reverse()

 - Returns WebDBQuery.

#### schema

 - Object.

The schema definition for the table.

#### toArray()

 - Returns Promise<Array>.

#### update(url, updates)
#### update(url, fn)

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise<Void>.

#### upsert(url, updates)

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - Returns Promise<Void>.

#### where(key)

 - `key` String.
 - Returns IngestWhereClause.

#### Event: 'index-updated'

 - `url` String. The site that was updated.
 - `version` Number. The version which was updated to.

### Instance: WebDBQuery

#### clone()

 - Returns WebDBQuery.

#### count()

 - Returns Promise<Number>. The number of found records.

#### delete()

 - Returns Promise<Number>. The number of deleted records.

#### each(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise<Void>.

#### eachKey(fn)

 - `fn` Function.
   - `key` String.
   - Returns Void.
 - Returns Promise<Void>.

Gives the value of the query's primary key for each matching record.

#### eachUrl(fn)

 - `fn` Function.
   - `url` String.
   - Returns Void.
 - Returns Promise<Void>.

Gives the URL of each matching record.

#### filter(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

#### first()

 - Returns Promise<Object>.

#### keys()

 - Returns Promise<Array<String>>.

#### last()

 - Returns Promise<Object>.

#### limit(n)

 - `n` Number.
 - Returns WebDBQuery.

#### offset(n)

 - `n` Number.
 - Returns WebDBQuery.

#### orderBy(key)

 - `key` String.
 - Returns WebDBQuery.

#### put(record)

 - `record` Object.
 - Returns Promise<Number>. The number of written records.

#### urls()

 - Returns Promise<Array<String>>.

#### reverse()

 - Returns WebDBQuery.

#### toArray()

 - Returns Promise<Array<Object>>.

#### uniqueKeys()

 - Returns Promise<Array<String>>.

#### until(fn)

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

#### update(update)
#### update(fn)

 - `update` Object. The new values to set on the record.
 - `updates` Object. The new values to set on the record.
 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise<Number>. The number of updated records.

#### where(key)

 - `key` String. The attribute to query against.
 - Returns IngestWhereClause.

### Instance: WebDBWhereClause

#### above(value)

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

#### aboveOrEqual(value)

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

#### anyOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

#### anyOfIgnoreCase(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

#### below(value)

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

#### belowOrEqual(value)

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

#### between(lowerValue, upperValue[, options])

 - `lowerValue` Any.
 - `upperValue` Any.
 - `options` Object.
   - `includeUpper` Boolean.
   - `includeLower` Boolean.
 - Returns WebDBQuery.

#### equals(value)

 - `value` Any.
 - Returns WebDBQuery.

#### equalsIgnoreCase(value)

 - `value` Any.
 - Returns WebDBQuery.

#### noneOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

#### notEqual(value)

 - `value` Any.
 - Returns WebDBQuery.

#### startsWith(value)

 - `value` Any.
 - Returns WebDBQuery.

#### startsWithAnyOf(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

#### startsWithAnyOfIgnoreCase(values)

 - `values` Array<Any>.
 - Returns WebDBQuery.

#### startsWithIgnoreCase(value)

 - `value` Any.
 - Returns WebDBQuery.


## How it works

WebDB abstracts over the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html) to provide a simple database-like interface. It is inspired by [Dexie.js](https://github.com/dfahlander/Dexie.js) and built using LevelDB. (In the browser, it runs on IndexedDB using [level.js](https://github.com/maxogden/level.js).

WebDB works by scanning a set of source archives for files that match a path pattern. Those files are indexed ("ingested") so that they can be queried easily. WebDB also provides a simple interface for adding, editing, and removing records on the archives that the local user owns.

WebDB sits on top of Dat archives. It duplicates the data it's handling into IndexedDB, and that duplicated data acts as a throwaway cache -- it can be reconstructed at any time from the Dat archives.

WebDB treats individual files in the Dat archive as individual records in a table. As a result, there's a direct mapping for each table to a folder of .json files. For instance, if you had a 'tweets' table, it would map to the `/tweets/*.json` files. WebDB's mutators, such as put or add or update, simply write those json files. WebDB's readers & query-ers, such as get() or where(), read from the IndexedDB cache.

WebDB watches its source archives for changes to the json files. When they change, it reads them and updates IndexedDB, thus the query results stay up-to-date. The flow is, roughly: `put() -> archive/tweets/12345.json -> indexer -> indexeddb -> get()`.