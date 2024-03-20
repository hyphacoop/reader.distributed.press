import { db } from './dbInstance.js'

class DistributedOutbox extends HTMLElement {
  constructor () {
    super()
    this.renderedItems = new Map() // Tracks rendered items by ID
    this.numPosts = 32 // Default value
    this.page = 1 // Default value
    this.totalPages = 0 // Keep track of total pages
  }

  static get observedAttributes () {
    return ['url', 'num-posts', 'page']
  }

  connectedCallback () {
    // Use attributes or default values
    this.numPosts =
      parseInt(this.getAttribute('num-posts'), 10) || this.numPosts
    this.page = parseInt(this.getAttribute('page'), 10) || this.page
    this.loadOutbox(this.getAttribute('url'))
  }

  async loadOutbox (outboxUrl) {
    this.clearContent()
    for await (const item of this.fetchOutboxItems(outboxUrl)) {
      this.processItem(item)
    }
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

  async * fetchOutboxItems (outboxUrl) {
    if (!outboxUrl) {
      console.error('No outbox URL provided')
      return
    }

    /*
    this.totalPages = Math.ceil(items.length / this.numPosts);
    this.page = Math.min(this.page, this.totalPages);

      // Calculate the range of items to be loaded based on the current page and numPosts
      const startIndex = (this.page - 1) * this.numPosts;
      const endIndex = startIndex + this.numPosts;

      const itemsToLoad = items.slice(startIndex, endIndex);
      */

    // TODO: Ingest actor and searchActivities instead
    yield * db.iterateCollection(outboxUrl)
  }

  renderItem (item) {
    const activityElement = document.createElement('distributed-activity')
    activityElement.type = item.type
    activityElement.data = item
    this.appendChild(activityElement)
  }

  nextPage () {
    const currentPage = this.page
    if (currentPage < this.totalPages) {
      this.setAttribute('page', currentPage + 1)
    }
  }

  prevPage () {
    const currentPage = this.page
    this.setAttribute('page', Math.max(1, currentPage - 1))
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'url') {
      this.clearContent()
      this.loadOutbox(newValue)
    } else if (name === 'num-posts' || name === 'page') {
      // Convert attribute name from kebab-case to camelCase
      const propName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      this[propName] = parseInt(newValue, 10)
      this.clearContent()
      this.loadOutbox(this.getAttribute('url'))
    }
  }

  clearContent () {
    // Clear existing content
    this.innerHTML = ''
    this.renderedItems.clear()
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
      postUrl = this.activityData.id
    } else {
      postUrl = this.activityData.object
    }
    this.displayPostContent(postUrl)
  }

  displayPostContent (url) {
    // Clear existing content
    this.innerHTML = ''

    // Create and append the distributed-post component
    const distributedPostElement = document.createElement('distributed-post')
    distributedPostElement.setAttribute('url', url)
    this.appendChild(distributedPostElement)
  }

  displayUnimplemented () {
    const message = `Activity type ${this.activityType} is not implemented yet.`
    const messageElement = document.createElement('p')
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
        // TODO: Add UI saying this was "reposted"
        this.fetchAndDisplayPost()
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

  displayFollowActivity () {
    const from = this.activityData.actor
    const to = this.activityData.object
    const message = `New follow request from ${from} to ${to}`
    const messageElement = document.createElement('p')
    messageElement.textContent = message
    this.appendChild(messageElement)
  }

  displayLikeActivity () {
    const message = `New like on ${this.activityData.object}`
    const messageElement = document.createElement('p')
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
