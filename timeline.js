import { db } from './dbInstance.js'

let hasLoaded = false

class ReaderTimeline extends HTMLElement {
  skip = 0
  limit = 32
  hasMoreItems = true
  sort = 'latest'
  loadMoreBtn = null
  randomNotes = [] // Cache for random notes
  randomIndex = 0 // Current index in the random notes cache

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

  connectedCallback () {
    this.initializeSortOrder()
    this.initializeDefaultFollowedActors().then(() => this.initTimeline())
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
    this.randomIndex = 0
    this.randomNotes = []
    this.hasMoreItems = true
    while (this.firstChild) {
      this.removeChild(this.firstChild)
    }
    this.loadMore()
  }

  async initializeDefaultFollowedActors () {
    const defaultActors = [
      'https://social.distributed.press/v1/@announcements@social.distributed.press/',
      'ipns://distributed.press/about.ipns.jsonld',
      'hyper://hypha.coop/about.hyper.jsonld',
      'https://sutty.nl/about.jsonld'
      // "https://akhilesh.sutty.nl/about.jsonld",
      // "https://staticpub.mauve.moe/about.jsonld",
    ]

    const hasFollowedActors = await db.hasFollowedActors()
    if (!hasFollowedActors) {
      await Promise.all(defaultActors.map(actorUrl => db.followActor(actorUrl)))
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
    this.loadMoreBtnWrapper.remove()
    let count = 0

    if (this.sort === 'random' && this.randomNotes.length === 0) {
      const allNotes = []
      for await (const note of db.searchNotesRandom(this.limit)) {
        allNotes.push(note)
      }
      this.randomNotes = allNotes.sort(() => Math.random() - 0.5)
    }

    const notesToShow = this.sort === 'random'
      ? this.randomNotes.slice(this.randomIndex, this.randomIndex + this.limit)
      : await this.fetchSortedNotes()

    for (const note of notesToShow) {
      if (note) {
        this.appendNoteElement(note)
        count++
      }
    }

    this.updateIndexes(count)
    this.appendLoadMoreIfNeeded()
  }

  async fetchSortedNotes () {
    const notesGenerator = db.searchNotes({}, { skip: this.skip, limit: this.limit, sort: this.sort === 'oldest' ? 1 : -1 })
    const notes = []
    for await (const note of notesGenerator) {
      notes.push(note)
    }
    return notes
  }

  updateIndexes (count) {
    if (this.sort === 'random') {
      this.randomIndex += this.limit
      this.hasMoreItems = this.randomIndex < this.randomNotes.length
    } else {
      this.skip += this.limit
      this.hasMoreItems = count === this.limit
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
