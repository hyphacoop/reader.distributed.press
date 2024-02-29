import { openDB } from './dependencies/idb/index.js'

export const DEFAULT_DB = 'default'
export const ACTORS_STORE = 'actors'
export const NOTES_STORE = 'notes'
export const ACTIVITIES_STORE = 'activities'

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
export const ACTOR_FIELD = 'actor'

export const PUBLISHED_SUFFIX = ', published'

export const TYPE_CREATE = 'Create'
export const TYPE_NOTE = 'Note'
export const TYPE_DELETE = 'Delete'

// TODO: When ingesting notes and actors, wrap any dates in `new Date()`
// TODO: When ingesting notes add a "tag_names" field which is just the names of the tag
// TODO: When ingesting notes, also load their replies
// TODO: Detect P2P URLs and use gateways (wrap `fetch` with it?)

export class ActivityPubDB {
  constructor (db, fetch = globalThis.fetch) {
    this.db = db
    this.fetch = fetch
  }

  static async load (name = DEFAULT_DB, fetch = globalThis.fetch) {
    const db = await openDB(name, 1, {
      upgrade
    })

    return new ActivityPubDB(db, fetch)
  }

  async #get (url) {
    if (url && typeof url === 'object') {
      return url
    }
    // TODO: Signed fetch
    const response = await this.fetch.call(globalThis, url, {
      headers: {
        Accept: 'application/json'
      }
    })
    if (!response.ok) {
      throw new Error(await response.text())
    }

    return await response.json()
  }

  async getActor (url) {
    // TODO: Try to load from cache
    const actor = await this.#get(url)
    this.db.put(ACTORS_STORE, actor)
    return this.db.get(ACTORS_STORE, actor.id)
  }

  async getNote (url) {
    try {
      return this.db.get(NOTES_STORE, url)
    } catch {
      const note = await this.#get(url)
      await this.ingestNote(note)
      return note
    }
  }

  async * searchNotes (query) {
    // Query can search by any of the indexed fields.
    // Everything gets sorted by the `published` time.
    // We should find a way to allow for arrays of values and open multiple iterators
    // Kinda like this: https://git.sr.ht/~breatheoutbreathein/ushin-db/tree/master/item/USHINBase.js#L509

    const tx = this.db.transaction(NOTES_STORE)

    for await (const item of tx.store) {
      yield item.value
    }
  }

  async ingestActor (url) {
    const actor = await this.getActor(url)
    // TODO: What else can we ingest from an actor?
    // Ingest outbox as collection
    const { outbox } = actor

    // TODO: Use actor.id?
    await this.ingestActivityCollection(outbox, url)
  }

  async * iterateCollection (url) {
    const collection = await this.#get(url)
    // TODO: handle paging and skiping
    const items = collection.items || collection.orderedItems

    if (!items) throw new Error(`Unable to find items at ${url}`)
    for await (const item of items) {
      if (typeof item === 'string') {
        const data = await this.#get(item)
        yield data
      } else yield item
    }
  }

  async ingestActivityCollection (url, verifyAttributed = '') {
    for await (const activity of this.iterateCollection(url)) {
      if (verifyAttributed && activity.actor !== verifyAttributed) {
        throw new Error(`Collection contained activity not attributed to ${verifyAttributed} at ${url} in activity ${activity.id}`)
      }
      await this.ingestActivity(activity)
    }
  }

  async ingestActivity (activity) {
    activity.published = new Date(activity.published)
    console.log(activity)
    await this.db.put(ACTIVITIES_STORE, activity)
    if (activity.type === TYPE_CREATE) {
      const object = await this.#get(activity.object)
      if (object.type === TYPE_NOTE) {
        console.log(object)
        await this.ingestNote(object)
      }
    } else if (activity.type === TYPE_DELETE) {
      await this.deleteNote(activity.object)
    }
  }

  async ingestNote (note) {
  // Convert needed fields to date
    note.published = new Date(note.published)
    // Add tag_names field
    note.tag_names = (note.tags || []).map(({ name }) => name)
    this.db.put(NOTES_STORE, note)
    // TODO: Loop through replies
  }

  async deleteNote (url) {
    // delete note using the url as the `id` from the notes store
    this.db.delete(NOTES_STORE, url)
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

  addRegularIndex(notes, TO_FIELD)
  addRegularIndex(notes, URL_FIELD)
  addRegularIndex(notes, TAG_NAMES_FIELD, { multiEntry: true })
  addSortedIndex(notes, IN_REPLY_TO_FIELD)
  addSortedIndex(notes, ATTRIBUTED_TO_FIELD)
  addSortedIndex(notes, CONVERSATION_FIELD)
  addSortedIndex(notes, TO_FIELD)

  const activities = db.createObjectStore(ACTIVITIES_STORE, {
    keyPath: 'id',
    autoIncrement: false
  })
  addSortedIndex(activities, ACTOR_FIELD)
  addSortedIndex(activities, TO_FIELD)

  function addRegularIndex (store, field, options = {}) {
    store.createIndex(field, field, options)
  }
  function addSortedIndex (store, field, options = {}) {
    store.createIndex(field + ', published', [field, PUBLISHED_FIELD], options)
  }
}
