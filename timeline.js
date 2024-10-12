import { db } from './dbInstance.js'
import { applyDefaults, initializeDefaultFollowedActors } from './defaults.js'

let hasLoaded = false

class ReaderTimeline extends HTMLElement {
  skip = 0
  limit = 32
  hasMoreItems = true
  sort = 'latest'
  totalNotesCount = 0
  loadedNotesCount = 0
  loadMoreBtn = null
  loadingText = null

  constructor () {
    super()

    // Create the Load More button
    this.loadMoreBtn = document.createElement('button')
    this.loadMoreBtn.textContent = 'Load More...'
    this.loadMoreBtn.className = 'load-more-btn'

    this.loadMoreBtnWrapper = document.createElement('div')
    this.loadMoreBtnWrapper.className = 'load-more-btn-container'
    this.loadMoreBtnWrapper.appendChild(this.loadMoreBtn)

    this.loadMoreBtn.addEventListener('click', () => this.loadMore())

    // Create the loading text element
    this.loadingText = document.createElement('div')
    this.loadingText.textContent = 'Loading...'
    this.loadingText.className = 'loading-text'
  }

  async connectedCallback () {
    // Show the loading text when initializing
    this.appendChild(this.loadingText)

    await applyDefaults()
    this.initializeSortOrder()
    await initializeDefaultFollowedActors()
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
    this.appendChild(this.loadingText) // Show loading text when resetting timeline
    await this.loadMore()
  }

  async initTimeline () {
    if (!hasLoaded) {
      hasLoaded = true

      const followedActors = await db.getFollowedActors()

      // Ensure all followed actors are ingested before loading notes.
      await Promise.all(followedActors.map(({ url }) => db.ingestActor(url)))
      console.log('All followed actors have been ingested')

      // Load the timeline notes after ingestion.
      this.resetTimeline()
    } else {
      this.loadMore() // Start loading notes immediately if already loaded.
    }
  }

  async loadMore () {
    // Hide loadMore button when fetching new data
    this.loadMoreBtnWrapper.remove()

    // Show loading text while fetching new notes
    this.appendChild(this.loadingText)

    let notesProcessed = 0
    let count = 0

    const sortValue = this.sort === 'random' ? 0 : (this.sort === 'oldest' ? 1 : -1)

    // Fetch notes and render them as they become available
    for await (const note of db.searchNotes({ timeline: 'following' }, { skip: this.skip, limit: this.limit, sort: sortValue })) {
      console.log('Loading note:', note)

      // Exclude replies from appearing in the timeline
      if (!note.inReplyTo) {
        this.appendNoteElement(note)
        count++
      }
      notesProcessed++
    }

    // Remove loading text once fetching is done
    if (this.contains(this.loadingText)) {
      this.removeChild(this.loadingText)
    }

    this.updateHasMore(count, notesProcessed, sortValue)
    this.appendLoadMoreIfNeeded() // Ensure this is called even if no notes are found
  }

  updateHasMore (count, notesProcessed, sortValue) {
    this.skip += notesProcessed

    if (this.sort === 'random') {
      // For random, we need to compare against the total number of notes
      this.loadedNotesCount += count
      this.hasMoreItems = this.loadedNotesCount < this.totalNotesCount
    } else {
      // For other sorts, check if the fetched notes are less than the limit
      this.hasMoreItems = notesProcessed === this.limit
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
