const IDB = require('./idb-wrapper')
const InjestWhereClause = require('./where-clause')
const {assert} = require('./util')
const {QueryError, ParameterError} = require('./errors')

class InjestRecordSet {
  constructor (table) {
    this._table = table
    this._filters = []
    this._direction = 'next'
    this._offset = 0
    this._limit = false
    this._until = null
    this._distinct = false
    this._where = null
  }

  // () => InjestRecordSet
  clone () {
    var clone = new InjestRecordSet()
    for (var k in this) {
      if (k.startsWith('_')) {
        clone[k] = this[k]
      }
    }
    return clone
  }

  // () => Promise<Number>
  async count () {
    var count = 0
    await this.each(() => { count++ })
    return count
  }

  // () => Promise<Number>
  async delete () {
    // TODO
  }

  // () => InjestRecordSet
  distinct () {
    this._distinct = true
    return this
  }

  // (Function) => Promise<Void>
  async each (fn) {
    return IDB.iterate(this, fn)
  }

  // (Function) => Promise<Void>
  async eachKey (fn) {
    assert(typeof fn === 'function', ParameterError, `First parameter of .eachKey() must be a function, got ${fn}`)
    return this.each(cursor => { fn(cursor[this._table.schema.primaryKey || '_url']) })
  }

  // (Function) => Promise<Void>
  async eachUrl (fn) {
    assert(typeof fn === 'function', ParameterError, `First parameter of .eachUrl() must be a function, got ${fn}`)
    return this.each(cursor => { fn(cursor._url) })
  }

  // (Function) => InjestRecordSet
  filter (fn) {
    assert(typeof fn === 'function', ParameterError, `First parameter of .filter() must be a function, got ${fn}`)
    this._filters.push(fn)
    return this
  }

  // () => Promise<Object>
  async first () {
    var arr = await this.limit(1).toArray()
    return arr[0]
  }

  // () => Promise<Array<String>>
  async keys () {
    var keys = []
    await this.eachKey(key => keys.push(key))
    return keys
  }

  // () => Promise<Object>
  async last () {
    return this.reverse().first()
  }

  // (Number) => InjestRecordSet
  limit (n) {
    assert(typeof n === 'number', ParameterError, `The first parameter to .limit() must be a number, got ${n}`)
    this._limit = n
    return this
  }

  // (Number) => InjestRecordSet
  offset (n) {
    assert(typeof n === 'number', ParameterError, `The first parameter to .offset() must be a number, got ${n}`)
    this._offset = n
    return this
  }

  // (index) => InjestWhereClause
  or (index) {
    assert(this._where, QueryError, 'Can not have a .or() before a .where()')
    // TODO
  }

  // (index) => InjestRecordset
  orderBy (index) {
    assert(typeof index === 'string', ParameterError, `The first parameter to .orderBy() must be a string, got ${index}`)
    assert(!this._where, QueryError, 'Can not have an .orderBy() and a .where() - where() implicitly sets the orderBy() to its key')
    this._where = new InjestWhereClause(this, index)
    return this
  }

  // () => Promise<Array<String>>
  async urls () {
    var urls = []
    await this.eachUrl(url => urls.push(url))
    return urls
  }

  // () => InjestRecordSet
  reverse () {
    this._direction = this._direction === 'prev' ? 'next' : 'prev'
    return this
  }

  // () => Promise<Array<Object>>
  async toArray () {
    var records = []
    await this.each(record => records.push(record))
    return records
  }

  // () => Promise<Array<String>>
  async uniqueKeys () {
    return Array.from(new Set(await this.keys()))
  }

  // (Function) => InjestRecordSet
  until (fn) {
    assert(typeof fn === 'function', ParameterError, `First parameter of .until() must be a function, got ${fn}`)
    this._until = fn
    return this
  }

  // (Object|Function) => Promise<Number>
  async update (objOrFn) {
    // TODO
  }

  // (index|query) => InjestWhereClause|InjestRecordSet
  where (indexOrQuery) {
    assert(!this._where, QueryError, 'Can not have two .where()s unless they are separated by a .or()')
    this._where = new InjestWhereClause(this, indexOrQuery)
    return this._where
  }
}

module.exports = InjestRecordSet
