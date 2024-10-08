import { db } from './dbInstance.js'

let hasLoaded = false

class ReaderTimeline extends HTMLElement {
  skip = 0
  limit = 32
  hasMoreItems = true
  sort = 'latest'
  totalNotesCount = 0
  loadedNotesCount = 0
  loadMoreBtn = null

  constructor () {
    super()
    this.loadMoreBtn = document.createElement('button')
    this.loadMoreBtn.textContent = 'Load More...'
    this.loadMoreBtn.className = 'load-more-btn'

    this.loadMoreBtnWrapper = document.createElement('div')
    this.loadMoreBtnWrapper.className = 'load-more-btn-container'
    this.loadMoreBtnWrapper.appendChild(this.loadMoreBtn)

    this.loadMoreBtn.addEventListener('click', () => this.loadMore())
  }

  async connectedCallback () {
    this.initializeSortOrder()
    await this.initializeDefaultFollowedActors()
    await this.initTimeline()
  }

  initializeSortOrder () {
    const params = new URLSearchParams(window.location.search)
    this.sort = params.get('sort') || 'latest'

    const sortOrderSelect = document.getElementById('sortOrder')
    if (sortOrderSelect) {
      sortOrderSelect.value = this.sort
      sortOrderSelect.addEventListener('change', (event) => {
        this.sort = event.target.value
        this.updateURL()
        this.resetTimeline()
      })
    }
  }

  updateURL () {
    const url = new URL(window.location)
    url.searchParams.set('sort', this.sort)
    window.history.pushState({}, '', url)
  }

  async resetTimeline () {
    this.skip = 0
    this.totalNotesCount = await db.getTotalNotesCount()
    this.loadedNotesCount = 0
    this.hasMoreItems = true
    while (this.firstChild) {
      this.removeChild(this.firstChild)
    }
    await this.loadMore()
  }

  async initializeDefaultFollowedActors () {
    const defaultActors = [
      'https://social.distributed.press/v1/@announcements@social.distributed.press/',
      'ipns://distributed.press/about.ipns.jsonld',
      'hyper://hypha.coop/about.hyper.jsonld',
      'https://sutty.nl/about.jsonld'
    ]

    const hasFollowedActors = await db.hasFollowedActors()
    if (!hasFollowedActors) {
      await Promise.all(defaultActors.map(actorUrl => db.followActor(actorUrl)))
    }
  }

  async initTimeline () {
    if (!hasLoaded) {
      hasLoaded = true
      // No need to re-ingest actors; they've been ingested in initializeDefaultFollowedActors()
      await this.resetTimeline()
    } else {
      await this.loadMore()
    }
  }

  async loadMore () {
    this.loadMoreBtnWrapper.remove()
    let count = 0

    const sortValue = this.sort === 'random' ? 0 : (this.sort === 'oldest' ? 1 : -1)

    // Fetch notes and render them as they become available
    for await (const note of db.searchNotes({ timeline: 'following', excludeReplies: true }, { skip: this.skip, limit: this.limit, sort: sortValue })) {
      console.log('Loading note:', note)
      this.appendNoteElement(note)
      count++
    }

    this.updateHasMore(count, sortValue)
    this.appendLoadMoreIfNeeded()
  }

  updateHasMore (count, sortValue) {
    this.skip += count

    if (this.sort === 'random') {
      // For random, we need to compare against the total number of notes
      this.loadedNotesCount += count
      this.hasMoreItems = this.loadedNotesCount < this.totalNotesCount
    } else {
      // In the "newest" timeline, check if we have exactly `this.limit` notes
      if (sortValue === -1) { // Newest first
        this.hasMoreItems = count === this.limit
      } else if (sortValue === 1) { // Oldest first
        this.hasMoreItems = count > 0 // As long as we're receiving notes, assume there are more
      }
    }
  }

  appendLoadMoreIfNeeded () {
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
