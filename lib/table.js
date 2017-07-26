class InjestTable {
  constructor () {
    // TODO
    this.name = null // TODO
    this.schema = null // TODO
  }

  add (url, record) {
    // TODO (url|DatArchive, record) => Promise<url>
  }

  count () {
    // TODO () => Promise<Number>
  }

  delete (url) {
    // TODO (url) => Promise<url>
  }

  each (fn) {
    // TODO (Function) => Promise<Void>
  }

  filter (fn) {
    // TODO (Function) => InjestRecordset
  }

  get (urlOrQuery) {
    // TODO (url | query) => Promise<InjestArchive>
  }

  limit (n) {
    // TODO (Number) => InjestRecordset
  }

  offset (n) {
    // TODO (Number) => InjestRecordset
  }

  orderBy (index) {
    // TODO (index) => InjestRecordset
  }

  reverse () {
    // TODO () => InjestRecordset
  }

  toArray () {
    // TODO () => Promise<Array>
  }

  toCollection () {
    // TODO () => InjestRecordset
  }

  update (url, record) {
    // TODO (url, record) => Promise<url>
  }

  where (indexOrQuery) {
    // TODO (index|query) => InjestWhereClause|InjestRecordset
  }
}
