import { openDB } from './dependencies/idb/index.js'

export const ACTORS_STORE = 'actors'
export const NOTES_STORE = 'notes'
export const ID_FIELD = 'id'
export const URL_FIELD = 'url'
export const CREATED_FIELD = 'created'
export const UPDATED_FIELD = 'updated'
export const PUBLISHED_FIELD = 'published'
export const TO_FIELD = 'to'
export const CC_FIELD = 'cc'
export const IN_REPLY_TO_FIELD = 'inReplyTo'
export const TAG_NAMES_FIELD = 'tag_names'
export const ATTRIBUTED_TO_FIELD = 'attributedTo'
export const CONVERSATION_FIELD = 'conversation'

// TODO: When ingesting notes and actors, wrap any dates in `new Date()`
// TODO: When ingesting notes add a "tag_names" field which is just the names of the tag
// TODO: When ingesting notes, also load their replies
// TODO: Detect P2P URLs and use gateways (wrap `fetch` with it?)

export class ActivityPubDB {
  constructor (db, fetch = globalThis.fetch) {
    this.db = db
    this.fetch = fetch
  }

  static async load (name, fetch = globalThis.fetch) {
    const db = await openDB(name, 1, {
      upgrade
    })

    return new ActivityPubDB(db, fetch)
  }

  async getActor (url) {
    // Try to load from db
    // else try to ingest then load from db
    const request = await this.fetch(url, { headers: { Accept: 'application/ld+json' } })
    // Handle 404
    const actor = await request.json()
    this.db.add(ACTORS_STORE, actor)
    return this.db.get(ACTORS_STORE, actor.id)
  }

  async getNote (url) {
    // Try to load from db
    // Else try to ingest then load from db
  }

  async * searchNotes (query) {
    // Query can search by any of the indexed fields.
    // Everything gets sorted by the `published` time.
    // We should find a way to allow for arrays of values and open multiple iterators
    // Kinda like this: https://git.sr.ht/~breatheoutbreathein/ushin-db/tree/master/item/USHINBase.js#L509
  }

  async ingestActor (url) {
    // Load actor and save to actors store
    // Ingest outbox as collection
  }

  async ingestCollection (url, verifyAttributed = '') {
    // Load outbox as async iterator, handle extra pages
    // Go through each activity and if it's a note, ingest or delete it
  }

  async ingestNote (url) {
  // Load by url
  // Convert needed fields to date
  // Add tag_names field
    // Add to notes store
    // Loop through replies (if possible) and ingest them
  }

  async deleteNote (url) {
    // delete note using the url as the `id` from the notes store
  }
}

function upgrade (db) {
  const actors = db.createObjectStore(ACTORS_STORE, {
    keyPath: 'id',
    autoIncrement: false
  })

  actors.createIndex(CREATED_FIELD, CREATED_FIELD)
  actors.createIndex(UPDATED_FIELD, UPDATED_FIELD)
  actors.createIndex(URL_FIELD, URL_FIELD)

  const notes = db.createObjectStore(NOTES_STORE, {
    keyPath: 'id',
    autoIncrement: false
  })

  addRegularIndex(PUBLISHED_FIELD)
  addRegularIndex(TO_FIELD)
  addRegularIndex(URL_FIELD)
  addSortedIndex(TAG_NAMES_FIELD, { multiEntry: true })
  addSortedIndex(IN_REPLY_TO_FIELD)
  addSortedIndex(ATTRIBUTED_TO_FIELD)
  addSortedIndex(CONVERSATION_FIELD)
  addSortedIndex(TO_FIELD)

  function addRegularIndex (field, options = {}) {
    notes.createIndex(field, field, options)
  }
  function addSortedIndex (field, options = {}) {
    notes.createIndex(field, [field, PUBLISHED_FIELD], options)
  }
}
