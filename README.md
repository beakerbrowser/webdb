# WebDB

A database that reads and writes records on dat:// websites. [How it works](#how-it-works)

## Example

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
  // uses JSONSchema v6
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
  index: ['lastName', 'lastName+firstName', 'age'],

  // files to index
  filePattern: [
    '/person.json',
    '/people/*.json'
  ]
})
```

Then open the DB:

```js
await webdb.open()
```

Next we add source archives to be indexed. The source archives are persisted in IndexedDB/LevelDB, so this doesn't have to be done every run.

```js
// add as source to the people table:
await webdb.people.addSource('dat://alice.com')
await webdb.people.addSource(['dat://bob.com', 'dat://carla.com'])

// add as source to all tables:
await webdb.addSource('dat://alice.com')
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
  .equals('dat://bob.com')
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
await webdb.people.put('dat://bob.com/person.json', {
  firstName: 'Bob',
  lastName: 'Roberts',
  age: 31
})

// update the record if it exists
await webdb.people.update('dat://bob.com/person.json', {
  age: 32
})

// update or create the record
await webdb.people.upsert('dat://bob.com/person.json', {
  age: 32
})

// delete the record
await webdb.people.delete('dat://bob.com/person.json')

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

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [How to use WebDB](#how-to-use-webdb)
  - [Table definitions](#table-definitions)
  - [Indexing sites](#indexing-sites)
  - [Creating queries](#creating-queries)
  - [Applying linear-scan filters](#applying-linear-scan-filters)
  - [Applying query modifiers](#applying-query-modifiers)
  - [Executing 'read' queries](#executing-read-queries)
  - [Executing 'write' queries](#executing-write-queries)
  - [Table helper methods](#table-helper-methods)
  - [Default attributes](#default-attributes)
  - [Handling multiple schemas](#handling-multiple-schemas)
- [Class: WebDB](#class-webdb)
  - [new WebDB([name])](#new-webdbname)
  - [WebDB.delete([name])](#webdbdeletename)
- [Instance: WebDB](#instance-webdb)
  - [webdb.open()](#webdbopen)
  - [webdb.close()](#webdbclose)
  - [webdb.define(name, definition)](#webdbdefinename-definition)
  - [webdb.addSource(url)](#webdbaddsourceurl)
  - [webdb.removeSource(url)](#webdbremovesourceurl)
  - [webdb.listSources()](#webdblistsources)
  - [Event: 'open'](#event-open)
  - [Event: 'open-failed'](#event-open-failed)
  - [Event: 'versionchange'](#event-versionchange)
  - [Event: 'indexes-updated'](#event-indexes-updated)
- [Instance: WebDBTable](#instance-webdbtable)
  - [table.addSource(url)](#tableaddsourceurl)
  - [table.removeSource(url)](#tableremovesourceurl)
  - [table.listSources()](#tablelistsources)
  - [table.count()](#tablecount)
  - [table.delete(url)](#tabledeleteurl)
  - [table.each(fn)](#tableeachfn)
  - [table.filter(fn)](#tablefilterfn)
  - [table.get(url)](#tablegeturl)
  - [table.get(key, value)](#tablegetkey-value)
  - [table.isRecordFile(url)](#tableisrecordfileurl)
  - [table.limit(n)](#tablelimitn)
  - [table.listRecordFiles(url)](#tablelistrecordfilesurl)
  - [table.name](#tablename)
  - [table.offset(n)](#tableoffsetn)
  - [table.orderBy(key)](#tableorderbykey)
  - [table.put(url, record)](#tableputurl-record)
  - [table.query()](#tablequery)
  - [table.reverse()](#tablereverse)
  - [table.schema](#tableschema)
  - [table.toArray()](#tabletoarray)
  - [table.update(url, updates)](#tableupdateurl-updates)
  - [table.update(url, fn)](#tableupdateurl-fn)
  - [table.upsert(url, updates)](#tableupserturl-updates)
  - [table.where(key)](#tablewherekey)
  - [Event: 'index-updated'](#event-index-updated)
- [Instance: WebDBQuery](#instance-webdbquery)
  - [query.clone()](#queryclone)
  - [query.count()](#querycount)
  - [query.delete()](#querydelete)
  - [query.each(fn)](#queryeachfn)
  - [query.eachKey(fn)](#queryeachkeyfn)
  - [query.eachUrl(fn)](#queryeachurlfn)
  - [query.filter(fn)](#queryfilterfn)
  - [query.first()](#queryfirst)
  - [query.keys()](#querykeys)
  - [query.last()](#querylast)
  - [query.limit(n)](#querylimitn)
  - [query.offset(n)](#queryoffsetn)
  - [query.orderBy(key)](#queryorderbykey)
  - [query.put(record)](#queryputrecord)
  - [query.urls()](#queryurls)
  - [query.reverse()](#queryreverse)
  - [query.toArray()](#querytoarray)
  - [query.uniqueKeys()](#queryuniquekeys)
  - [query.until(fn)](#queryuntilfn)
  - [query.update(updates)](#queryupdateupdates)
  - [query.update(fn)](#queryupdatefn)
  - [query.where(key)](#querywherekey)
- [Instance: WebDBWhereClause](#instance-webdbwhereclause)
  - [where.above(value)](#whereabovevalue)
  - [where.aboveOrEqual(value)](#whereaboveorequalvalue)
  - [where.anyOf(values)](#whereanyofvalues)
  - [where.anyOfIgnoreCase(values)](#whereanyofignorecasevalues)
  - [where.below(value)](#wherebelowvalue)
  - [where.belowOrEqual(value)](#wherebeloworequalvalue)
  - [where.between(lowerValue, upperValue[, options])](#wherebetweenlowervalue-uppervalue-options)
  - [where.equals(value)](#whereequalsvalue)
  - [where.equalsIgnoreCase(value)](#whereequalsignorecasevalue)
  - [where.noneOf(values)](#wherenoneofvalues)
  - [where.notEqual(value)](#wherenotequalvalue)
  - [where.startsWith(value)](#wherestartswithvalue)
  - [where.startsWithAnyOf(values)](#wherestartswithanyofvalues)
  - [where.startsWithAnyOfIgnoreCase(values)](#wherestartswithanyofignorecasevalues)
  - [where.startsWithIgnoreCase(value)](#wherestartswithignorecasevalue)
- [How it works](#how-it-works)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## How to use WebDB

### Table definitions

Use the [`define()`](#webdbdefinename-definition) method to define your tables, and then call [`webdb.open()`](#webdbopen) to create them.
Schemas are defined using [JSON Schema v6](http://json-schema.org/).

### Indexing sites

Use [`addSource()`](#webdbaddsourceurl) and [`removeSource()`](#webdbremovesourceurl) to control which sites will be indexed.
Sources are stored in metadata and so `addSource()` does not have to be called for each site on load (but it doesn't cause harm if you do).

### Creating queries

Queries are created with a chained function API.
You can create a query from the table object using [`.query()`](#tablequery), [`.where()`](#tablewherekey), or [`.orderBy()`](#tableorderbykey).
The `where()` method returns an object with [multiple filter functions that you can use](#instance-webdbwhereclause).

```js
var myQuery = webdb.query().where('foo').equals('bar')
var myQuery = webdb.where('foo').equals('bar') // equivalent
var myQuery = webdb.where('foo').startsWith('ba')
var myQuery = webdb.where('foo').between('bar', 'baz', {includeLower: true, includeUpper: false})
```

Each query has a primary key.
By default, this is the `url` attribute, but it can be changed using [`.where()`](#querywherekey) or [`.orderBy()`](#queryorderbykey).
In this example, the primary key becomes 'foo':

```js
var myQuery = webdb.orderBy('foo')
```

At this time, the primary key must be one of the indexed attributes.
There are 2 indexes created automatically for every record: `url` and `origin`.
The other indexes are specified in your table's [`define()`](#webdbdefinename-definition) call using the `index` option.

### Applying linear-scan filters

After the primary key index is applied, you can apply additional filters using [filter(fn)](#queryfilterfn) and [until(fn)](#queryuntilfn).
These methods are called "linear scan" filters because they require each record to be loaded and then filtered out.
(Until stops when it hits the first `false` response.)

```js
var myQuery = webdb.query()
  .where('foo').equals('bar')
  .filter(record => record.beep == 'boop') // additional filter
```

### Applying query modifiers

You can apply the following modifiers to your query to alter the output:

  - [limit(n)](#querylimitn)
  - [offset(n)](#queryoffsetn)
  - [reverse()](#queryreverse)

### Executing 'read' queries

Once your query has been defined, you can execute and read the results using one of these methods:

  - [count()](#querycount)
  - [each(fn)](#queryeachfn)
  - [eachKey(fn)](#queryeachkeyfn)
  - [eachUrl(fn)](#queryeachurlfn)
  - [first()](#queryfirst)
  - [keys()](#querykeys)
  - [last()](#querylast)
  - [urls()](#queryurls)
  - [toArray()](#querytoarray)
  - [uniqueKeys()](#queryuniquekeys)

### Executing 'write' queries

Once your query has been defined, you can execute and *modify* the results using one of these methods:

  - [delete()](#querydelete)
  - [put(record)](#queryputrecord)
  - [update(updates)](#queryupdateupdates)
  - [update(fn)](#queryupdatefn)

### Table helper methods

The following methods exist on the table object for query reads and writes:

  - [table.delete(url)](#tabledeleteurl)
  - [table.each(fn)](#tableeachfn)
  - [table.get(url)](#tablegeturl)
  - [table.get(key, value)](#tablegetkey-value)
  - [table.put(url, record)](#tableputurl-record)
  - [table.toArray()](#tabletoarray)
  - [table.update(url, updates)](#tableupdateurl-updates)
  - [table.update(url, fn)](#tableupdateurl-fn)
  - [table.upsert(url, updates)](#tableupserturl-updates)

### Default attributes

Every record has the following attributes overridden by WebDB:

 - `url` String. The URL of the record.
 - `origin` String. The URL of the site the record was found on.
 - `indexedAt` String. The timestamp of when the record was indexed.

The `origin` is always included in the secondary indexes.
These attributes should not be used in schemas, as they will always be overriden.

### Handling multiple schemas

Since the Web is a complex place, you'll frequently have to deal with multiple schemas which are slightly different.
This is solved in a two-step process.

Step 1, use [JSON Schema's support for multiple definitions](https://spacetelescope.github.io/understanding-json-schema/reference/combining.html#anyof) to define as many schemas as you want to match:

```js
  schema: {
    anyOf: [
      { 
        type: 'object',
        properties: {
          name: {type: 'string'},
          zip_code: {type: 'string'}
        },
        required: ['name', 'zip_code']
      },
      { 
        type: 'object',
        properties: {
          name: {type: 'string'},
          zipCode: {type: 'string'}
        },
        required: ['name', 'zipCode']
      }
    ]
  }
```

Step 2, in your index, use a definition object to support multiple attribute names under one index.

```js
  index: [
    // a simple index definition:
    'name',

    // an object index definition:
    {name: 'zipCode', def: ['zipCode', 'zip_code']}
  ]
```

Now, when you run queries on the `'zipCode'` key, you will search against both `'zipCode'` and `'zip_code'`.
Note, however, that the records emitted from the query will not be changed by WebDB and so they may differ.

For example:

```js
webdb.places.where('zipCode').equals('78705').each(record => {
  console.log(record.zipCode) // may be '78705' or undefined
  console.log(record.zip_code) // may be '78705' or undefined
})
```

## Class: WebDB

### new WebDB([name])

```js
var webdb = new WebDB('mydb')
```

 - `name` String. Defaults to `'webdb'`. If run in the browser, this will be the name of the IndexedDB instance. If run in NodeJS, this will be the path of the LevelDB folder.

Create a new `WebDB` instance.
The given `name` will control where the indexes are saved.
You can specify different names to run multiple WebDB instances at once.

### WebDB.delete([name])

```js
await WebDB.delete('mydb')
```

 - `name` String. Defaults to `'webdb'`. If run in the browser, this will be the name of the IndexedDB instance. If run in NodeJS, this will be the path of the LevelDB folder.
 - Returns Promise&lt;Void&gt;.

Deletes the indexes and metadata for the given WebDB.

## Instance: WebDB

### webdb.open()

```js
await webdb.open()
```

 - Returns Promise&lt;Void&gt;.

Runs final setup for the WebDB instance.
This must be run after [`.define()`](#webdbdefinename-definition) to create the table instances.

### webdb.close()

```js
await webdb.close()
```

 - Returns Promise&lt;Void&gt;.

Closes and deconstructs the WebDB instance.

### webdb.define(name, definition)

 - `name` String. The name of the table.
 - `definition` Object.
   - `schema` Object. A [JSON Schema v6](http://json-schema.org/) definition.
   - `index` Array&lt;String or Object&gt;. A list of attributes which should have secondary indexes produced for querying. Each `index` value is a keypath (see https://www.w3.org/TR/IndexedDB/#dfn-key-path) or an object definition (see below).
   - `filePattern` String or Array&lt;String&gt;. An [anymatch](https://www.npmjs.com/package/anymatch) list of files to index.
 - Returns Void.

Creates a new table on the `webdb` object.
The table will be set at `webdb.{name}` and be the `WebDBTable` type.
This method must be called before [`open()`](#webdbopen)

Indexes may either be defined as a [keypath string](https://www.w3.org/TR/IndexedDB/#dfn-key-path) or an object definition.
The object definition has the following values:

 - `name` String. The name of the index.
 - `def` String or Array&lt;String&gt;. The definition of the index.

If the value of `def` is an array, it supports each definition.
This is useful when supporting multiple schemas ([learn more here](#handling-multiple-schemas)).

In the index definition, you can specify compound indexes with a `+` separator in the keypath.
You can also index each value of an array using the `*` sigil at the start of the name.
Some example index definitions:

```
a simple index           - 'firstName'
as an object def         - {name: 'firstName', def: 'firstName'}
a compound index         - 'firstName+lastName'
index an array's values  - '*favoriteFruits'
many keys                - {name: 'firstName', def: ['firstName', 'first_name']}
many keys, compound      - {name: 'firstName+lastName', def: ['firstName+lastName', 'first_name+last_name']}
```

You can specify which files should be processed into the table using the `filePattern` option.
If unspecified, it will default to all json files on the site (`'*.json'`).

Example:

```js
webdb.define('people', {
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
  index: ['lastName', 'lastName+firstName', 'age'],
  filePattern: [
    '/person.json',
    '/people/*.json'
  ]
})

await webdb.open()
// the new table will now be defined at webdb.people
```

### webdb.addSource(url)

```js
await webdb.addSource('dat://foo.com')
```

 - `url` String or DatArchive or Array&lt;String or DatArchive&gt;. The sites to index.
 - Returns Promise&lt;Void&gt;.

Add one or more dat:// sites to be indexed.
The method will return when the site has been fully indexed.
The added sites are saved, and therefore only need to be added once.

### webdb.removeSource(url)

```js
await webdb.removeSource('dat://foo.com')
```

 - `url` String or DatArchive. The site to deindex.
 - Returns Promise&lt;Void&gt;.

Remove a dat:// site from the dataset.
The method will return when the site has been fully de-indexed.

### webdb.listSources()

```js
var urls = await webdb.listSources()
```

 - Returns Promise&lt;String&gt;.

Lists the URLs of the dat:// sites which are included in the dataset.

### Event: 'open'

```js
webdb.on('open', () => {
  console.log('WebDB is ready for use')
})
```

Emitted when the WebDB instance has been opened using [`open()`](#webdbopen).

### Event: 'open-failed'

```js
webdb.on('open-failed', (err) => {
  console.log('WebDB failed to open', err)
})
```

 - `error` Error.

Emitted when the WebDB instance fails to open during [`open()`](#webdbopen).

### Event: 'versionchange'

```js
webdb.on('versionchange', () => {
  console.log('WebDB detected a change in schemas and rebuilt all data')
})
```

Emitted when the WebDB instance detects a change in the schemas and has to reindex the dataset.

### Event: 'indexes-updated'

```js
webdb.on('indexes-updated', (url, version) => {
  console.log('Tables were updated for', url, 'at version', version)
})
```

 - `url` String. The site that was updated.
 - `version` Number. The version which was updated to.

Emitted when the WebDB instance has updated the stored data for a site.

## Instance: WebDBTable

### table.addSource(url)

```js
await webdb.mytable.addSource('dat://foo.com')
```

 - `url` String or DatArchive or Array&lt;String or DatArchive&gt;. The sites to index.
 - Returns Promise&lt;Void&gt;.

Add one or more dat:// sites to be indexed on the table.
The method will return when the site has been fully indexed.
The added sites are saved, and therefore only need to be added once.

### table.removeSource(url)

```js
await webdb.mytable.removeSource('dat://foo.com')
```

 - `url` String or DatArchive. The site to deindex.
 - Returns Promise&lt;Void&gt;.

Remove a dat:// site from the table's dataset.
The method will return when the site has been fully de-indexed.

### table.listSources()

```js
var urls = await webdb.mytable.listSources()
```

 - Returns Promise&lt;String&gt;.

Lists the URLs of the dat:// sites which are included in the table's dataset.

### table.count()

```js
var numRecords = await webdb.mytable.count()
```

 - Returns Promise&lt;Number&gt;.

Count the number of records in the table.

### table.delete(url)

```js
await webdb.mytable.delete('dat://foo.com/bar.json')
```

 - Returns Promise&lt;Void&gt;.

Delete the record at the given URL.

### table.each(fn)

```js
await webdb.mytable.each(record => {
  console.log(record)
})
```

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise&lt;Void&gt;.

Iterate over all records in the table with the given function.

### table.filter(fn)

```js
var records = await webdb.mytable.filter(record => {
  return (record.foo == 'bar')
})
```

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

Start a new query and apply the given filter function to the resultset.

### table.get(url)

```js
var record = await webdb.mytable.get('dat://foo.com/myrecord.json')
```

 - `url` String. The URL of the record to fetch.
 - Returns Promise&lt;Object&gt;.

Get the record at the given URL.

### table.get(key, value)

```js
var record = await webdb.mytable.get('foo', 'bar')
```

 - `key` String. The keyname to search against.
 - `value` Any. The value to match against.
 - Promise&lt;Object&gt;.
 
Get the record first record to match the given key/value query.

### table.isRecordFile(url)

```js
var isRecord = webdb.mytable.isRecordFile('dat://foo.com/myrecord.json')
```

 - `url` String.
 - Returns Boolean.

Tells you whether the given URL matches the table's file pattern.

### table.limit(n)

```js
var query = webdb.mytable.limit(10)
```

 - `n` Number.
 - Returns WebDBQuery.

Creates a new query with the given limit applied.

### table.listRecordFiles(url)

```js
var recordFiles = await webdb.mytable.listRecordFiles('dat://foo.com')
```

 - `url` String.
 - Returns Promise&lt;Array&lt;Object&gt;&gt;. On each object:
   - `recordUrl` String.
   - `table` WebDBTable.

Lists all files on the given URL which match the table's file pattern.

### table.name

 - String.

The name of the table.

### table.offset(n)

```js
var query = webdb.mytable.offset(5)
```

 - `n` Number.
 - Returns WebDBQuery.

Creates a new query with the given offset applied.

### table.orderBy(key)

```js
var query = webdb.mytable.orderBy('foo')
```

 - `key` String.
 - Returns WebDBQuery.

Creates a new query ordered by the given key.

### table.put(url, record)

```js
await webdb.mytable.put('dat://foo.com/myrecord.json', {foo: 'bar'})
```

 - `url` String.
 - `record` Object.
 - Returns Promise&lt;Void&gt;.

Replaces or creates the record at the given URL with the `record`.

### table.query()

```js
var query = webdb.mytable.query()
```

 - Returns WebDBQuery.

Creates a new query.

### table.reverse()

```js
var query = webdb.mytable.reverse()
```

 - Returns WebDBQuery.

Creates a new query with reverse-order applied.

### table.schema

 - Object.

The schema definition for the table.

### table.toArray()

```js
var records = await webdb.mytable.toArray()
```

 - Returns Promise&lt;Array&gt;.

Returns an array of all records in the table.

### table.update(url, updates)

```js
var wasUpdated = await webdb.mytable.update('dat://foo.com/myrecord.json', {foo: 'bar'})
```

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - Returns Promise&lt;Boolean&gt;.

Updates the target record with the given key values, if it exists.
Returns `false` if the target record did not exist.

### table.update(url, fn)

```js
var wasUpdated = await webdb.mytable.update('dat://foo.com/myrecord.json', record => {
  record.foo = 'bar'
  return record
})
```

 - `url` String. The record to update.
 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise&lt;Boolean&gt;.

Updates the target record with the given function, if it exists.
Returns `false` if the target record did not exist.

### table.upsert(url, updates)

```js
var didCreateNew = await webdb.mytable.upsert('dat://foo.com/myrecord.json', {foo: 'bar'})
```

 - `url` String. The record to update.
 - `updates` Object. The new values to set on the record.
 - Returns Promise&lt;Boolean&gt;.

If a record exists at the target URL, will update it with the given key values.
If a record does not exist, will create the record.
Returns `true` if the target record was created.

### table.where(key)

```js
var whereClause = webdb.mytable.where('foo')
```

 - `key` String.
 - Returns IngestWhereClause.

Creates a new where-clause using the given key.

### Event: 'index-updated'

```js
webdb.mytable.on('index-updated', (url, version) => {
  console.log('Table was updated for', url, 'at version', version)
})
```

 - `url` String. The site that was updated.
 - `version` Number. The version which was updated to.

Emitted when the table has updated the stored data for a site.

## Instance: WebDBQuery

### query.clone()

```js
var query = webdb.mytable.query().clone()
```

 - Returns WebDBQuery.

Creates a copy of the query.

### query.count()

```js
var numRecords = await webdb.mytable.query().count()
```

 - Returns Promise&lt;Number&gt;. The number of found records.

Gives the count of records which match the query.

### query.delete()

```js
var numDeleted = await webdb.mytable.query().delete()
```

 - Returns Promise&lt;Number&gt;. The number of deleted records.

Deletes all records which match the query.

### query.each(fn)

```js
await webdb.mytable.query().each(record => {
  console.log(record)
})
```

 - `fn` Function.
   - `record` Object.
   - Returns Void.
 - Returns Promise&lt;Void&gt;.

Calls the given function with all records which match the query.

### query.eachKey(fn)

```js
await webdb.mytable.query().eachKey(url => {
  console.log('URL =', url)
})
```

 - `fn` Function.
   - `key` String.
   - Returns Void.
 - Returns Promise&lt;Void&gt;.

Calls the given function with the value of the query's primary key for each matching record.

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

Example:

```js
await webdb.mytable.orderBy('age').eachKey(age => {
  console.log('Age =', age)
})
```

### query.eachUrl(fn)

```js
await webdb.mytable.query().eachUrl(url => {
  console.log('URL =', url)
})
```

 - `fn` Function.
   - `url` String.
   - Returns Void.
 - Returns Promise&lt;Void&gt;.

Calls the given function with the URL of each matching record.

### query.filter(fn)

```js
var query = webdb.mytable.query().filter(record => {
  return record.foo == 'bar'
})
```

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

Applies an additional filter on the query.

### query.first()

```js
var record = await webdb.mytable.query().first()
```

 - Returns Promise&lt;Object&gt;.

Returns the first result in the query.

### query.keys()

```js
var keys = await webdb.mytable.query().keys()
```

 - Returns Promise&lt;Array&lt;String&gt;&gt;.

Returns the value of the primary key for each matching record.

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

```js
var ages = await webdb.mytable.orderBy('age').keys()
```

### query.last()

```js
var record = await webdb.mytable.query().last()
```

 - Returns Promise&lt;Object&gt;.

Returns the last result in the query.

### query.limit(n)

```js
var query = webdb.mytable.query().limit(10)
```

 - `n` Number.
 - Returns WebDBQuery.

Limits the number of matching record to the given number.

### query.offset(n)

```js
var query = webdb.mytable.query().offset(10)
```

 - `n` Number.
 - Returns WebDBQuery.

Skips the given number of matching records.

### query.orderBy(key)

```js
var query = webdb.mytable.query().orderBy('foo')
```

 - `key` String.
 - Returns WebDBQuery.

Sets the primary key and sets the resulting order to match its values.

### query.put(record)

```js
var numWritten = await webdb.mytable.query().put({foo: 'bar'})
```

 - `record` Object.
 - Returns Promise&lt;Number&gt;. The number of written records.

Replaces each matching record with the given value.

### query.urls()

```js
var urls = await webdb.mytable.query().urls()
```

 - Returns Promise&lt;Array&lt;String&gt;&gt;.

Returns the url of each matching record.

### query.reverse()

```js
var query = webdb.mytable.query().reverse()
```

 - Returns WebDBQuery.

Reverses the order of the results.

### query.toArray()

```js
var records = await webdb.mytable.query().toArray()
```

 - Returns Promise&lt;Array&lt;Object&gt;&gt;.

Returns the value of each matching record.

### query.uniqueKeys()

```js
var keys = await webdb.mytable.query().uniqueKeys()
```

 - Returns Promise&lt;Array&lt;String&gt;&gt;.

Returns the value of the primary key for each matching record, with duplicates filtered out.

The `key` is determined by the index being used.
By default, this is the `url` attribute, but it can be changed by using `where()` or `orderBy()`.

Example: 

```js
var ages = await webdb.mytable.orderBy('age').uniqueKeys()
```

### query.until(fn)

```js
var query = webdb.mytable.query().until(record => {
  return record.foo == 'bar'
})
```

 - `fn` Function.
   - `record` Object.
   - Returns Boolean.
 - Returns WebDBQuery.

Stops emitting matching records when the given function returns true.

### query.update(updates)

```js
var numUpdated = await webdb.mytable.query().update({foo: 'bar'})
```

 - `updates` Object. The new values to set on the record.
 - Returns Promise&lt;Number&gt;. The number of updated records.

Updates all matching record with the given values.

### query.update(fn)

```js
var numUpdated = await webdb.mytable.query().update(record => {
  record.foo = 'bar'
  return record
})
```

 - `fn` Function. A method to modify the record.
   - `record` Object. The record to modify.
   - Returns Object.
 - Returns Promise&lt;Number&gt;. The number of updated records.

Updates all matching record with the given function.

### query.where(key)

```js
var whereClause = webdb.mytable.query().where('foo')
```

 - `key` String. The attribute to query against.
 - Returns IngestWhereClause.

Creates a new where clause.

## Instance: WebDBWhereClause

### where.above(value)

```js
var query = webdb.mytable.query().where('foo').above('bar')
var query = webdb.mytable.query().where('age').above(18)
```

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

### where.aboveOrEqual(value)

```js
var query = webdb.mytable.query().where('foo').aboveOrEqual('bar')
var query = webdb.mytable.query().where('age').aboveOrEqual(18)
```

 - `value` Any. The lower bound of the query.
 - Returns WebDBQuery.

### where.anyOf(values)

```js
var query = webdb.mytable.query().where('foo').anyOf(['bar', 'baz'])
```

 - `values` Array&lt;Any&gt;.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.anyOfIgnoreCase(values)

```js
var query = webdb.mytable.query().where('foo').anyOfIgnoreCase(['bar', 'baz'])
```

 - `values` Array&lt;Any&gt;.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.below(value)

```js
var query = webdb.mytable.query().where('foo').below('bar')
var query = webdb.mytable.query().where('age').below(18)
```

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

### where.belowOrEqual(value)

```js
var query = webdb.mytable.query().where('foo').belowOrEqual('bar')
var query = webdb.mytable.query().where('age').belowOrEqual(18)
```

 - `value` Any. The upper bound of the query.
 - Returns WebDBQuery.

### where.between(lowerValue, upperValue[, options])

```js
var query = webdb.mytable.query().where('foo').between('bar', 'baz', {includeUpper: true, includeLower: true})
var query = webdb.mytable.query().where('age').between(18, 55, {includeLower: true})
```

 - `lowerValue` Any.
 - `upperValue` Any.
 - `options` Object.
   - `includeUpper` Boolean.
   - `includeLower` Boolean.
 - Returns WebDBQuery.

### where.equals(value)

```js
var query = webdb.mytable.query().where('foo').equals('bar')
```

 - `value` Any.
 - Returns WebDBQuery.

### where.equalsIgnoreCase(value)

```js
var query = webdb.mytable.query().where('foo').equalsIgnoreCase('bar')
```

 - `value` Any.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.noneOf(values)

```js
var query = webdb.mytable.query().where('foo').noneOf(['bar', 'baz'])
```

 - `values` Array&lt;Any&gt;.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.notEqual(value)

```js
var query = webdb.mytable.query().where('foo').notEqual('bar')
```

 - `value` Any.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.startsWith(value)

```js
var query = webdb.mytable.query().where('foo').startsWith('ba')
```

 - `value` Any.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.startsWithAnyOf(values)

```js
var query = webdb.mytable.query().where('foo').startsWithAnyOf(['ba', 'bu'])
```

 - `values` Array&lt;Any&gt;.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.startsWithAnyOfIgnoreCase(values)

```js
var query = webdb.mytable.query().where('foo').startsWithAnyOfIgnoreCase(['ba', 'bu'])
```

 - `values` Array&lt;Any&gt;.
 - Returns WebDBQuery.

Does not work on compound indexes.

### where.startsWithIgnoreCase(value)

```js
var query = webdb.mytable.query().where('foo').startsWithIgnoreCase('ba')
```

 - `value` Any.
 - Returns WebDBQuery.

Does not work on compound indexes.


## How it works

WebDB abstracts over the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html) to provide a simple database-like interface. It is inspired by [Dexie.js](https://github.com/dfahlander/Dexie.js) and built using [LevelDB](https://github.com/beakerbrowser/ingestdb/tree/webdb#webdb). (In the browser, it runs on IndexedDB using [level.js](https://github.com/maxogden/level.js).

WebDB scans a set of source Dat archives for files that match a path pattern. Those files are indexed ("ingested") so that they can be queried easily. WebDB also provides a simple interface for adding, editing, and removing records from archives.

WebDB sits on top of Dat archives. It duplicates ingested data into IndexedDB, which acts as a throwaway cache. The cached data can be reconstructed at any time from the source Dat archives.

WebDB treats individual files in the Dat archive as individual records in a table. As a result, there's a direct mapping for each table to a folder of JSON files. For instance, if you had a `tweets` table, it might map to the `/tweets/*.json` files. WebDB's mutators, e.g., `put`, `add`, `update`, simply writes records as JSON files in the `tweets/` directory. WebDB's readers and query-ers, like `get()` and `where()`, read from the IndexedDB cache.

WebDB watches its source archives for changes to the JSON files that compose its records. When the files change, it syncs and reads the changes, then updates IndexedDB, keeping query results up-to-date. Roughly, the flow is: `put() -&gt; archive/tweets/12345.json -&gt; indexer -&gt; indexeddb -&gt; get()`.
