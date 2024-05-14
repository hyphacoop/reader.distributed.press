import { db } from './dbInstance.js'

class DistributedOutbox extends HTMLElement {
  skip = 0
  limit = 32

  constructor () {
    super()
    this.renderedItems = new Map() // Tracks rendered items by ID
  }

  static get observedAttributes () {
    return ['url']
  }

  connectedCallback () {
    this.outboxUrl = this.getAttribute('url')
    this.loadOutbox(this.outboxUrl)
  }

  async loadOutbox (outboxUrl) {
    this.clearContent()
    const items = await this.collectItems(outboxUrl, { skip: this.skip, limit: this.limit + 1 })
    items.slice(0, this.limit).forEach(item => this.processItem(item))

    // Update skip for next potential load
    this.skip += this.limit

    // Check if there are more items to load
    if (items.length > this.limit) {
      this.createLoadMoreButton()
    }
  }

  async loadMore () {
    this.removeLoadMoreButton()
    const items = await this.collectItems(this.outboxUrl, { skip: this.skip, limit: this.limit + 1 })
    items.slice(0, this.limit).forEach(item => this.processItem(item))

    this.skip += this.limit

    if (items.length > this.limit) {
      this.createLoadMoreButton()
    }
  }

  async collectItems (outboxUrl, { skip, limit }) {
    const items = []
    for await (const item of db.iterateCollection(outboxUrl, { skip, limit })) {
      items.push(item)
    }
    return items
  }

  processItem (item) {
    const itemKey = item.id || item.object
    if (!itemKey) {
      console.error('Item key is undefined, item:', item)
      return
    }
    if (!this.renderedItems.has(itemKey)) {
      this.renderItem(item)
      this.renderedItems.set(itemKey, true)
    }
  }

  renderItem (item) {
    const activityElement = document.createElement('distributed-activity')
    activityElement.type = item.type
    activityElement.data = item
    this.appendChild(activityElement)
  }

  createLoadMoreButton () {
    this.removeLoadMoreButton()

    const loadMoreBtn = document.createElement('button')
    loadMoreBtn.textContent = 'Load More'
    loadMoreBtn.className = 'load-more-btn'

    const loadMoreBtnWrapper = document.createElement('div')
    loadMoreBtnWrapper.className = 'load-more-btn-container'
    loadMoreBtnWrapper.appendChild(loadMoreBtn)

    loadMoreBtn.addEventListener('click', () => this.loadMore())
    this.appendChild(loadMoreBtnWrapper)
  }

  clearContent () {
    this.innerHTML = ''
    this.renderedItems.clear()
  }

  removeLoadMoreButton () {
    const loadMoreBtnWrapper = this.querySelector('.load-more-btn-container')
    if (loadMoreBtnWrapper) {
      loadMoreBtnWrapper.remove()
    }
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'url' && newValue !== oldValue) {
      this.outboxUrl = newValue
      this.loadOutbox(this.outboxUrl)
    }
  }
}

// Register the new element with the browser
customElements.define('distributed-outbox', DistributedOutbox)

class DistributedActivity extends HTMLElement {
  constructor () {
    super()
    this.activityType = ''
    this.activityData = {}
    this.activityUrl = null
  }

  static get observedAttributes () {
    return ['type', 'data', 'url']
  }

  async connectedCallback () {
    // Check if the component already has type and data set as properties
    if (this.type && this.data) {
      this.activityType = this.type
      this.activityData = this.data
      this.renderActivity()
    } else if (this.activityUrl) {
    // Load from URL if type and data are not set
      await this.loadDataFromUrl(this.activityUrl)
    } else {
      console.error('Activity data is not provided and no URL is specified.')
    }
  }

  async loadDataFromUrl (activityUrl) {
    try {
      const activityData = await db.getActivity(activityUrl)
      this.type = activityData.type
      this.data = activityData
      this.connectedCallback()
    } catch (error) {
      console.error('Error loading activity data from URL:', error)
    }
  }

  async fetchAndDisplayPost () {
    let postUrl
    // Determine the source of the post (direct activity or URL pointing to the activity)
    const isDirectPost =
      typeof this.activityData.object === 'string' ||
      this.activityData.object instanceof String

    if (isDirectPost) {
      postUrl = this.activityData.object
    } else if (this.activityData.object && this.activityData.object.id) {
      postUrl = this.activityData.object.id
    } else {
      postUrl = this.activityData.object
    }

    // Create and append the distributed-post component without clearing previous content
    const distributedPostElement = document.createElement('distributed-post')
    distributedPostElement.setAttribute('url', postUrl)
    this.appendChild(distributedPostElement)
  }

  displayUnimplemented () {
    const message = `Activity type ${this.activityType} is not implemented yet.`
    const messageElement = document.createElement('p')
    messageElement.classList.add('other-activity')
    messageElement.textContent = message
    this.appendChild(messageElement)
  }

  renderActivity () {
    // Clear existing content
    this.innerHTML = ''

    switch (this.activityType) {
      case 'Create':
        this.fetchAndDisplayPost()
        break
      case 'Update':
        this.fetchAndDisplayPost()
        break
      case 'Announce':
        this.displayRepostedActivity()
        break
      case 'Follow':
        this.displayFollowActivity()
        break
      case 'Like':
        this.displayLikeActivity()
        break
      default:
        this.displayUnimplemented()
        break
    }
  }

  displayRepostedActivity () {
    const actorUrl = this.activityData.actor
    db.getActor(actorUrl).then(actorData => {
      const actorDisplayName = actorData.preferredUsername || actorData.name || actorUrl.split('/').pop().split('@').pop() // Fallback to URL parsing if name is unavailable
      const repostLabel = document.createElement('p')
      repostLabel.textContent = `Reposted by ${actorDisplayName} ⇄`
      repostLabel.className = 'repost-label'
      this.appendChild(repostLabel)
      this.fetchAndDisplayPost()
    }).catch(error => {
      console.error('Error loading actor data:', error)
      this.fetchAndDisplayPost() // Continue to display the post even if actor loading fails
    })
  }

  displayFollowActivity () {
    const from = this.activityData.actor
    const to = this.activityData.object
    const message = `New follow request from ${from} to ${to}`
    const messageElement = document.createElement('p')
    messageElement.classList.add('other-activity')
    messageElement.textContent = message
    this.appendChild(messageElement)
  }

  displayLikeActivity () {
    const message = `New like on ${this.activityData.object}`
    const messageElement = document.createElement('p')
    messageElement.classList.add('other-activity')
    messageElement.textContent = message
    this.appendChild(messageElement)
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (newValue !== oldValue) {
      if (name === 'type') {
        this.activityType = newValue
        this.renderActivity()
      } else if (name === 'data') {
        this.activityData = JSON.parse(newValue)
        this.renderActivity()
      } else if (name === 'url') {
        this.loadDataFromUrl(newValue)
          .then(() => {
            this.renderActivity()
          })
          .catch((error) => {
            console.error('Error loading activity data from URL:', error)
          })
      }
    }
  }
}

// Register the new element with the browser
customElements.define('distributed-activity', DistributedActivity)
