/* globals DOMParser */
import { openDB } from './dependencies/idb/index.js'

export const DEFAULT_DB = 'default'
export const ACTORS_STORE = 'actors'
export const NOTES_STORE = 'notes'
export const ACTIVITIES_STORE = 'activities'
export const FOLLOWED_ACTORS_STORE = 'followedActors'
export const DEFAULT_LIMIT = 32

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

export const HYPER_PREFIX = 'hyper://'
export const IPNS_PREFIX = 'ipns://'

const ACCEPT_HEADER =
'application/activity+json, application/ld+json, application/json, text/html'

// TODO: When ingesting notes and actors, wrap any dates in `new Date()`
// TODO: When ingesting notes add a "tag_names" field which is just the names of the tag
// TODO: When ingesting notes, also load their replies

export function isP2P (url) {
  return url.startsWith(HYPER_PREFIX) || url.startsWith(IPNS_PREFIX)
}

const TIMELINE_ALL = 'all'
const TIMELINE_FOLLOWING = 'following'

export class ActivityPubDB extends EventTarget {
  constructor (db, fetch = globalThis.fetch) {
    super()
    this.db = db
    this.fetch = fetch
  }

  static async load (name = DEFAULT_DB, fetch = globalThis.fetch) {
    const db = await openDB(name, 3, {
      upgrade
    })

    return new ActivityPubDB(db, fetch)
  }

  resolveURL (url) {
    // TODO: Check if mention
    return this.#get(url)
  }

  getObjectPage (data) {
    if (typeof data === 'string') return data
    const { url, id } = data

    if (!url) return id
    if (typeof url === 'string') return url
    if (Array.isArray(url)) {
      const firstLink = url.find((item) => (typeof item === 'string') || item.href)
      if (firstLink) return firstLink.href || firstLink
    } else if (url.href) {
      return url.href
    }
    return id
  }

  #fetch (...args) {
    const { fetch } = this
    return fetch(...args)
  }

  #gateWayFetch (url, options = {}) {
    let gatewayUrl = url
    // TODO: Don't hardcode the gateway
    if (url.startsWith(HYPER_PREFIX)) {
      gatewayUrl = url.replace(HYPER_PREFIX, 'https://hyper.hypha.coop/hyper/')
    } else if (url.startsWith(IPNS_PREFIX)) {
      gatewayUrl = url.replace(IPNS_PREFIX, 'https://ipfs.hypha.coop/ipns/')
    }

    return this.#fetch(gatewayUrl, options)
  }

  #proxiedFetch (url, options = {}) {
    const proxiedURL = 'https://corsproxy.io/?' + encodeURIComponent(url)
    return this.#fetch(proxiedURL, options)
  }

  async #get (url) {
    if (url && typeof url === 'object') {
      return url
    }
    let response
    // Try fetching directly for all URLs (including P2P URLs)
    // TODO: Signed fetch
    try {
      response = await this.#fetch(url, {
        headers: {
          Accept: ACCEPT_HEADER
        }
      })
    } catch (error) {
      if (isP2P(url)) {
        // Maybe the browser can't load p2p URLs
        response = await this.#gateWayFetch(url, {
          headers: {
            Accept: ACCEPT_HEADER
          }
        })
      } else {
        // Try the proxy, maybe it's cors?
        response = await this.#proxiedFetch(url, {
          headers: {
            Accept: ACCEPT_HEADER
          }
        })
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}.\n${url}\n${await response.text()}`)
    }
    if (isResponseHTML(response)) {
      const jsonLdUrl = await getResponseLink(response)
      if (jsonLdUrl) return this.#get(jsonLdUrl)
      // No JSON-LD link found in HTML
      throw new Error('No JSON-LD link found in the response')
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
      const note = await this.db.get(NOTES_STORE, url)
      if (!note) throw new Error('Note not loaded')
      return note // Simply return the locally found note.
    } catch (error) {
      // If the note is not in the local store, fetch it but don't automatically ingest it.
      const note = await this.#get(url)
      return note // Return the fetched note for further processing by the caller.
    }
  }

  async getTotalNotesCount () {
    const tx = this.db.transaction(NOTES_STORE, 'readonly')
    const store = tx.objectStore(NOTES_STORE)
    const totalNotes = await store.count()
    return totalNotes
  }

  async getActivity (url) {
    try {
      return this.db.get(ACTIVITIES_STORE, url)
    } catch {
      const activity = await this.#get(url)
      await this.ingestActivity(activity)
      return activity
    }
  }

  async * searchActivities (actor, { limit = DEFAULT_LIMIT, skip = 0 } = {}) {
    const indexName = ACTOR_FIELD + ', published'
    const tx = this.db.transaction(ACTIVITIES_STORE, 'read')
    const index = tx.store.index(indexName)

    let count = 0

    for await (const cursor of index.iterate(actor)) {
      if (count === 0) {
        cursor.advance(skip)
      }
      yield cursor.value
      count++
      if (count >= limit) break
    }

    await tx.done()
  }

  async * searchNotes ({ attributedTo, inReplyTo } = {}, { skip = 0, limit = DEFAULT_LIMIT, sort = -1 } = {}) {
    const tx = this.db.transaction(NOTES_STORE, 'readonly')
    const indexName = inReplyTo ? IN_REPLY_TO_FIELD : (attributedTo ? `${ATTRIBUTED_TO_FIELD}, published` : PUBLISHED_FIELD)
    const index = tx.store.index(indexName)
    const direction = sort > 0 ? 'next' : 'prev'
    let cursor = await index.openCursor(null, direction)

    if (sort === 0) { // Random sort
      const totalNotes = await index.count()
      for (let i = 0; i < limit; i++) {
        const randomSkip = Math.floor(Math.random() * totalNotes)
        cursor = await index.openCursor()
        if (randomSkip > 0) {
          await cursor.advance(randomSkip)
        }
        if (cursor) {
          yield cursor.value
        }
      }
    } else {
      if (attributedTo) {
        cursor = await index.openCursor([attributedTo], direction)
      } else if (inReplyTo) {
        cursor = await index.openCursor(inReplyTo, direction)
      } else {
        cursor = await index.openCursor(null, direction)
      }

      if (skip) await cursor.advance(skip)

      let count = 0
      while (cursor) {
        if (count >= limit) break
        count++
        yield cursor.value
        cursor = await cursor.continue()
      }
    }

    await tx.done
  }

  async ingestActor (url, isInitial = false) {
    console.log(`Starting ingestion for actor from URL: ${url}`)
    const actor = await this.getActor(url)
    console.log('Actor received:', actor)

    // Add 'following' to timeline if the actor is followed
    const isFollowing = await this.isActorFollowed(url)
    if (isFollowing) {
      for await (const note of this.searchNotes({ attributedTo: actor.id })) {
        if (!note.timeline.includes(TIMELINE_FOLLOWING)) {
          note.timeline.push(TIMELINE_FOLLOWING)
          await this.db.put(NOTES_STORE, note)
        }
      }
    }

    // If actor has an 'outbox', ingest it as a collection
    if (actor.outbox) {
      await this.ingestActivityCollection(actor.outbox, actor.id, isInitial)
    } else {
      console.error(`No outbox found for actor at URL ${url}`)
    }

    // This is where we might add more features to our actor ingestion process.
    // e.g., if (actor.followers) { ... }
  }

  async ingestActivityCollection (collectionOrUrl, actorId, isInitial = false) {
    console.log(
      `Fetching collection for actor ID ${actorId}:`,
      collectionOrUrl
    )
    const sort = isInitial ? -1 : 1

    const cursor = this.iterateCollection(collectionOrUrl, {
      limit: Infinity,
      sort
    })

    for await (const activity of cursor) {
      // Assume newest items will be first
      const wasNew = await this.ingestActivity(activity, actorId)
      if (!wasNew) {
        console.log('Caught up with', actorId || collectionOrUrl)
        break
      }
    }
  }

  async * iterateCollection (collectionOrUrl, { skip = 0, limit = DEFAULT_LIMIT, sort = 1 } = {}) {
    const collection = await this.#get(collectionOrUrl)

    let items = collection.orderedItems || collection.items || []
    let next, prev

    if (sort === -1) {
      items = items.reverse()
      prev = collection.last // Start from the last page if sorting in descending order
    } else {
      next = collection.first // Start from the first page if sorting in ascending order
    }

    let toSkip = skip
    let count = 0

    if (items) {
      for await (const item of this.#getAll(items)) {
        if (toSkip > 0) {
          toSkip--
        } else {
          yield item
          count++
          if (count >= limit) return
        }
      }
    }

    // Iterate through pages in the specified order
    while (sort === -1 ? prev : next) {
      const page = await this.#get(sort === -1 ? prev : next)
      next = page.next
      prev = page.prev
      items = page.orderedItems || page.items

      if (sort === -1) {
        items = items.reverse()
      }

      for await (const item of this.#getAll(items)) {
        if (toSkip > 0) {
          toSkip--
        } else {
          yield item
          count++
          if (count >= limit) return
        }
      }
    }
  }

  async * #getAll (items) {
    for (const itemOrUrl of items) {
      const item = await this.#get(itemOrUrl)

      if (item) {
        yield item
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

    const existing = await this.db.get(ACTIVITIES_STORE, activity.id)
    if (existing) return false

    // Convert the published date to a Date object
    activity.published = new Date(activity.published)

    // Store the activity in the ACTIVITIES_STORE
    console.log('Ingesting activity:', activity)
    await this.db.put(ACTIVITIES_STORE, activity)

    if ((activity.type === TYPE_CREATE || activity.type === TYPE_UPDATE) && activity.actor) {
      const note = await this.#get(activity.object)
      if (note.type === TYPE_NOTE) {
        // Only ingest the note if the note's attributed actor is the same as the activity's actor
        if (note.attributedTo === activity.actor) {
          console.log('Ingesting note:', note)
          await this.ingestNote(note)
        } else {
          console.log(`Skipping note ingestion for actor mismatch: Note attributed to ${note.attributedTo}, but activity actor is ${activity.actor}`)
        }
      }
    } else if (activity.type === TYPE_DELETE) {
      // Handle 'Delete' activity type
      await this.deleteNote(activity.object)
    }

    return true
  }

  async ingestNote (note) {
    console.log('Ingesting note', note)

    if (typeof note === 'string') {
      note = await this.getNote(note) // Fetch the note if it's just a URL string
    }

    note.published = new Date(note.published) // Convert published to Date
    note.tag_names = (note.tags || []).map(({ name }) => name) // Extract tag names
    note.timeline = [TIMELINE_ALL]

    const isFollowingAuthor = await this.isActorFollowed(note.attributedTo)

    // Only add to the 'following' timeline if it's not a reply
    if (isFollowingAuthor && !note.inReplyTo) {
      note.timeline.push(TIMELINE_FOLLOWING)
    }

    const existingNote = await this.db.get(NOTES_STORE, note.id)
    if (existingNote && new Date(note.published) > new Date(existingNote.published)) {
      console.log(`Updating note with newer version: ${note.id}`)
      await this.db.put(NOTES_STORE, note)
    } else if (!existingNote) {
      console.log(`Adding new note: ${note.id}`)
      await this.db.put(NOTES_STORE, note)
    }

    // Handle replies recursively
    if (note.replies) {
      console.log('Attempting to load replies for:', note.id)
      await this.ingestReplies(note.replies)
    }
  }

  async ingestReplies (url) {
    console.log('Ingesting replies for URL:', url)
    try {
      const replies = await this.iterateCollection(url, { limit: Infinity })
      for await (const reply of replies) {
        await this.ingestNote(reply) // Recursively ingest replies
      }
    } catch (error) {
      console.error('Error ingesting replies:', error)
    }
  }

  async deleteNote (url) {
    // delete note using the url as the `id` from the notes store
    this.db.delete(NOTES_STORE, url)
  }

  // Method to follow an actor
  async followActor (url) {
    const followedAt = new Date()
    await this.db.put(FOLLOWED_ACTORS_STORE, { url, followedAt })

    await this.ingestActor(url, true)
    console.log(`Followed actor: ${url} at ${followedAt}`)
    this.dispatchEvent(new CustomEvent('actorFollowed', { detail: { url, followedAt } }))
  }

  // Method to unfollow an actor
  async unfollowActor (url) {
    await this.db.delete(FOLLOWED_ACTORS_STORE, url)
    await this.purgeActor(url)
    console.log(`Unfollowed and purged actor: ${url}`)
    this.dispatchEvent(new CustomEvent('actorUnfollowed', { detail: { url } }))
  }

  async purgeActor (url) {
    // First, remove the actor from the ACTORS_STORE
    const actor = await this.getActor(url)
    if (actor) {
      await this.db.delete(ACTORS_STORE, actor.id)
      console.log(`Removed actor: ${url}`)
    }

    // Remove all activities related to this actor from the ACTIVITIES_STORE using async iteration
    const activitiesTx = this.db.transaction(ACTIVITIES_STORE, 'readwrite')
    const activitiesStore = activitiesTx.objectStore(ACTIVITIES_STORE)
    const activitiesIndex = activitiesStore.index(ACTOR_FIELD)

    for await (const cursor of activitiesIndex.iterate(actor.id)) {
      await activitiesStore.delete(cursor.primaryKey)
    }

    await activitiesTx.done
    console.log(`Removed all activities related to actor: ${url}`)

    // Additionally, remove notes associated with the actor's activities using async iteration
    const notesTx = this.db.transaction(NOTES_STORE, 'readwrite')
    const notesStore = notesTx.objectStore(NOTES_STORE)
    const notesIndex = notesStore.index(ATTRIBUTED_TO_FIELD)

    for await (const cursor of notesIndex.iterate(actor.id)) {
      await notesStore.delete(cursor.primaryKey)
    }

    await notesTx.done
    console.log(`Removed all notes related to actor: ${url}`)
  }

  // Method to retrieve all followed actors
  async getFollowedActors () {
    const tx = this.db.transaction(FOLLOWED_ACTORS_STORE, 'readonly')
    const store = tx.objectStore(FOLLOWED_ACTORS_STORE)
    const followedActors = []
    for await (const cursor of store) {
      followedActors.push(cursor.value)
    }
    return followedActors
  }

  // Method to check if an actor is followed
  async isActorFollowed (url) {
    try {
      const record = await this.db.get(FOLLOWED_ACTORS_STORE, url)
      return !!record // Convert the record to a boolean indicating if the actor is followed
    } catch (error) {
      console.error(`Error checking if actor is followed: ${url}`, error)
      return false // Assume not followed if there's an error
    }
  }

  async hasFollowedActors () {
    const followedActors = await this.getFollowedActors()
    return followedActors.length > 0
  }

  async replyCount (inReplyTo) {
    console.log(`Counting replies for ${inReplyTo}`)
    await this.ingestNote(inReplyTo) // Ensure the note and its replies are ingested before counting
    const tx = this.db.transaction(NOTES_STORE, 'readonly')
    const store = tx.objectStore(NOTES_STORE)

    // Check if the index is correctly setup
    const index = store.index(IN_REPLY_TO_FIELD)

    const count = await index.count(inReplyTo)
    console.log(`Found ${count} replies for ${inReplyTo}`)
    return count
  }

  async setTheme (themeName) {
    await this.db.put('settings', { key: 'theme', value: themeName })
  }

  async getTheme () {
    const themeSetting = await this.db.get('settings', 'theme')
    return themeSetting ? themeSetting.value : null
  }
}

async function migrateNotes (db, transaction) {
  const store = transaction.objectStore(NOTES_STORE)

  for await (const cursor of store) {
    const note = cursor.value
    if (!note.timeline) {
      note.timeline = ['all']
    }
    const isFollowing = await db.isActorFollowed(note.attributedTo)
    if (isFollowing && !note.timeline.includes(TIMELINE_FOLLOWING)) {
      note.timeline.push(TIMELINE_FOLLOWING)
    }
    cursor.update(note)
  }
}

async function upgrade (db, oldVersion, newVersion, transaction) {
  if (oldVersion < 1) {
    const actors = db.createObjectStore(ACTORS_STORE, {
      keyPath: 'id',
      autoIncrement: false
    })

    actors.createIndex(CREATED_FIELD, CREATED_FIELD)
    actors.createIndex(UPDATED_FIELD, UPDATED_FIELD)
    actors.createIndex(URL_FIELD, URL_FIELD)

    db.createObjectStore(FOLLOWED_ACTORS_STORE, {
      keyPath: 'url'
    })

    const notes = db.createObjectStore(NOTES_STORE, {
      keyPath: 'id',
      autoIncrement: false
    })
    notes.createIndex(ATTRIBUTED_TO_FIELD, ATTRIBUTED_TO_FIELD, { unique: false })
    notes.createIndex(IN_REPLY_TO_FIELD, IN_REPLY_TO_FIELD, { unique: false })
    notes.createIndex(PUBLISHED_FIELD, PUBLISHED_FIELD, { unique: false })
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
    activities.createIndex(ACTOR_FIELD, ACTOR_FIELD)
    addSortedIndex(activities, ACTOR_FIELD)
    addSortedIndex(activities, TO_FIELD)
    addRegularIndex(activities, PUBLISHED_FIELD)

    db.createObjectStore('settings', { keyPath: 'key' })
  }

  if (oldVersion < 2) {
    await migrateNotes(db, transaction)
  }

  if (oldVersion < 3) {
    const notes = transaction.objectStore(NOTES_STORE)
    notes.createIndex('timeline, published', ['timeline', PUBLISHED_FIELD], { unique: false })
  }

  function addRegularIndex (store, field, options = {}) {
    store.createIndex(field, field, options)
  }
  function addSortedIndex (store, field, options = {}) {
    store.createIndex(field + ', published', [field, PUBLISHED_FIELD], options)
  }
}

// TODO: prefer p2p alternate links when possible
async function getResponseLink (response) {
// For HTML responses, look for the link in the HTTP headers
  const linkHeader = response.headers.get('Link')
  if (linkHeader) {
    const matches = linkHeader.match(
      /<([^>]+)>;\s*rel="alternate";\s*type="application\/ld\+json"/
    )
    if (matches && matches[1]) {
    // Found JSON-LD link in headers, fetch that URL
      return matches[1]
    }
  }
  // If no link header or alternate JSON-LD link is found, or response is HTML without JSON-LD link, process as HTML
  const htmlContent = await response.text()
  const jsonLdUrl = await parsePostHtml(htmlContent)

  return jsonLdUrl
}

async function parsePostHtml (htmlContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const alternateLinks = doc.querySelectorAll('link[rel="alternate"]')
  console.log(...alternateLinks)
  for (const link of alternateLinks) {
    if (!link.type) continue
    if (link.type.includes('application/ld+json') || link.type.includes('application/activity+json')) {
      return link.href
    }
  }
  return null
}

function isResponseHTML (response) {
  return response.headers.get('content-type').includes('text/html')
}
