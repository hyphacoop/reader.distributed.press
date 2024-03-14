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
export const TYPE_UPDATE = 'Update'
export const TYPE_NOTE = 'Note'
export const TYPE_DELETE = 'Delete'

// TODO: When ingesting notes and actors, wrap any dates in `new Date()`
// TODO: When ingesting notes add a "tag_names" field which is just the names of the tag
// TODO: When ingesting notes, also load their replies

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

    let response
    // Try fetching directly for all URLs (including P2P URLs)
    // TODO: Signed fetch
    try {
      response = await this.fetch.call(globalThis, url, {
        headers: {
          Accept: 'application/json'
        }
      })
    } catch (error) {
      console.error('P2P loading failed, trying HTTP gateway:', error)
    }

    // If direct fetch was not successful, attempt fetching from a gateway for P2P protocols
    if (!response || !response.ok) {
      let gatewayUrl = url

      if (url.startsWith('hyper://')) {
        gatewayUrl = url.replace('hyper://', 'https://hyper.hypha.coop/hyper/')
      } else if (url.startsWith('ipns://')) {
        gatewayUrl = url.replace('ipns://', 'https://ipfs.hypha.coop/ipns/')
      }

      try {
        response = await this.fetch.call(globalThis, gatewayUrl, {
          headers: {
            Accept: 'application/json'
          }
        })
      } catch (error) {
        console.error('Fetching from gateway failed:', error)
        throw new Error(`Failed to fetch ${url} from gateway`)
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return await response.json()
  }

  async getActor (url) {
    // TODO: Try to load from cache
    const actor = await this.#get(url)
    this.db.put(ACTORS_STORE, actor)
    return this.db.get(ACTORS_STORE, actor.id)
  }

  async getAllActors () {
    const tx = this.db.transaction(ACTORS_STORE)
    const actors = []

    for await (const cursor of tx.store) {
      actors.push(cursor.value)
    }

    return actors
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

  async searchNotes (criteria) {
    const tx = this.db.transaction(NOTES_STORE, 'readonly')
    const notes = []
    const index = criteria.attributedTo
      ? tx.store.index('attributedTo')
      : tx.store

    // Use async iteration to iterate over the store or index
    for await (const cursor of index.iterate(criteria.attributedTo)) {
      notes.push(cursor.value)
    }

    // Implement additional filtering logic if needed based on other criteria (like time ranges or tags)
    // For example:
    // notes.filter(note => note.published >= criteria.startDate && note.published <= criteria.endDate);
    return notes.sort((a, b) => b.published - a.published) // Sort by published date in descending order
  }

  async ingestActor (url) {
    console.log(`Starting ingestion for actor from URL: ${url}`)
    const actor = await this.getActor(url)
    console.log('Actor received:', actor)

    // If actor has an 'outbox', ingest it as a collection
    if (actor.outbox) {
      await this.ingestActivityCollection(actor.outbox, actor.id)
    } else {
      console.error(`No outbox found for actor at URL ${url}`)
    }

    // This is where we might add more features to our actor ingestion process.
    // e.g., if (actor.followers) { ... }
  }

  async ingestActivityCollection (collectionOrUrl, actorId) {
    let collection
    console.log(
      `Fetching collection for actor ID ${actorId}:`,
      collectionOrUrl
    )

    if (typeof collectionOrUrl === 'string') {
      // If the collection is a URL, fetch it first
      collection = await this.#get(collectionOrUrl)
    } else {
      // If the collection is an object, use it directly
      collection = collectionOrUrl
    }

    for await (const activity of this.iterateCollection(collection)) {
      await this.ingestActivity(activity, actorId)
    }
  }

  async * iterateCollection (collection) {
    // TODO: handle pagination here, if collection contains a 'next' or 'first' link.
    const items = collection.orderedItems || collection.items

    if (!items) {
      console.error('No items found in collection:', collection)
      return // Exit if no items to iterate over
    }

    for (const itemOrUrl of items) {
      let activity
      if (typeof itemOrUrl === 'string') {
        // Fetch the individual activity if the item is a URL
        activity = await this.#get(itemOrUrl)
      } else {
        // Use the item directly if it's an object
        activity = itemOrUrl
      }

      if (activity) {
        yield activity
      }
    }
  }

  async ingestActivity (activity) {
    // Check if the activity has an 'id' and create one if it does not
    if (!activity.id) {
      if (typeof activity.object === 'string') {
        // Use the URL of the object as the id for the activity
        activity.id = activity.object
      } else {
        console.error(
          'Activity does not have an ID and cannot be processed:',
          activity
        )
        return // Skip this activity
      }
    }

    // Convert the published date to a Date object
    activity.published = new Date(activity.published)

    // Store the activity in the ACTIVITIES_STORE
    console.log('Ingesting activity:', activity)
    await this.db.put(ACTIVITIES_STORE, activity)

    if (activity.type !== TYPE_CREATE || activity.type !== TYPE_UPDATE) {
      let note
      if (typeof activity.object === 'string') {
        note = await this.#get(activity.object)
      } else {
        note = activity.object
      }
      if (note.type === TYPE_NOTE) {
        note.id = activity.id; // Use the Create activity's ID for the note ID
        console.log("Ingesting note:", note);
        await this.ingestNote(note);
      }
    } else if (activity.type === TYPE_DELETE) {
      // Handle 'Delete' activity type
      await this.deleteNote(activity.object)
    }
  }

  async ingestNote (note) {
    // Convert needed fields to date
    note.published = new Date(note.published)
    // Add tag_names field
    note.tag_names = (note.tags || []).map(({ name }) => name)
    // Check if the note is already in the database to avoid duplicates
    const existingNote = await this.db.get(NOTES_STORE, note.id)
    if (!existingNote) {
      await this.db.put(NOTES_STORE, note)
    }
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
