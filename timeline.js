import { db } from './dbInstance.js'

let hasLoaded = false

class ReaderTimeline extends HTMLElement {
  skip = 0
  limit = 10
  hasMoreItems = true
  loadMoreBtn = null

  constructor () {
    super()
    this.loadMoreBtn = document.createElement('button')
    this.loadMoreBtn.textContent = 'Load More..'
    this.loadMoreBtn.className = 'load-more-btn'

    this.loadMoreBtnWrapper = document.createElement('div')
    this.loadMoreBtnWrapper.className = 'load-more-btn-container'
    this.loadMoreBtnWrapper.appendChild(this.loadMoreBtn)

    this.loadMoreBtn.addEventListener('click', () => this.loadMore())
  }

  connectedCallback () {
    this.initializeDefaultFollowedActors().then(() => this.initTimeline())
  }

  async initializeDefaultFollowedActors () {
    const defaultActors = [
      'https://social.distributed.press/v1/@announcements@social.distributed.press/',
      'https://hypha.coop/about.jsonld',
      'https://sutty.nl/about.jsonld'
      // "https://akhilesh.sutty.nl/about.jsonld",
      // "https://staticpub.mauve.moe/about.jsonld",
    ]

    // Check if followed actors have already been initialized
    const hasFollowedActors = await db.hasFollowedActors()
    if (!hasFollowedActors) {
      await Promise.all(
        defaultActors.map(async (actorUrl) => {
          await db.followActor(actorUrl)
        })
      )
    }
  }

  async initTimeline () {
    if (!hasLoaded) {
      hasLoaded = true
      const followedActors = await db.getFollowedActors()
      await Promise.all(followedActors.map(({ url }) => db.ingestActor(url)))
    }
    this.loadMore()
  }

  async loadMore () {
    // Remove the button before loading more items
    this.loadMoreBtnWrapper.remove()

    const notes = await db.searchNotes({}, { skip: this.skip, limit: this.limit })
    notes.forEach(note => this.appendNoteElement(note))

    // Update skip value and determine if there are more items
    this.skip += this.limit
    this.hasMoreItems = notes.length === this.limit

    // Append the button at the end if there are more items
    if (this.hasMoreItems) {
      this.appendChild(this.loadMoreBtnWrapper)
    }
  }

  appendNoteElement (note) {
    const activityElement = document.createElement('distributed-post')
    activityElement.setAttribute('url', note.id)
    this.appendChild(activityElement)
  }
}

customElements.define('reader-timeline', ReaderTimeline)
