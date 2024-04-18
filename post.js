/* global customElements, HTMLElement */
import DOMPurify from './dependencies/dompurify/purify.js'
import { db } from './dbInstance.js'

function formatDate (dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' }
  return new Date(dateString).toLocaleDateString(undefined, options)
}

// Helper function to calculate elapsed time (e.g., 1h, 1d, 1w)
function timeSince (dateString) {
  const date = new Date(dateString)
  const seconds = Math.floor((new Date() - date) / 1000)

  let interval = seconds / 31536000 // 365 * 24 * 60 * 60
  if (interval > 1) {
    return formatDate(dateString) // Return formatted date if more than a year
  }
  interval = seconds / 2592000 // 30 * 24 * 60 * 60
  if (interval > 1) {
    return Math.floor(interval) + 'mo'
  }
  interval = seconds / 604800 // 7 * 24 * 60 * 60
  if (interval > 1) {
    return Math.floor(interval) + 'w'
  }
  interval = seconds / 86400 // 24 * 60 * 60
  if (interval > 1) {
    return Math.floor(interval) + 'd'
  }
  interval = seconds / 3600 // 60 * 60
  if (interval > 1) {
    return Math.floor(interval) + 'h'
  }
  interval = seconds / 60
  if (interval > 1) {
    return Math.floor(interval) + 'm'
  }
  return Math.floor(seconds) + 's'
}

// Define a class for the <distributed-post> web component
class DistributedPost extends HTMLElement {
  static get observedAttributes () {
    return ['url']
  }

  connectedCallback () {
    this.loadAndRenderPost(this.getAttribute('url'))
  }

  async loadAndRenderPost (postUrl) {
    if (!postUrl) {
      this.renderErrorContent('No post URL provided')
      return
    }

    try {
      const content = await db.getNote(postUrl)

      // Assuming JSON-LD content has a "summary" field
      this.renderPostContent(content)
    } catch (error) {
      console.error(error)
      this.renderErrorContent(error.message)
    }
  }

  renderPostContent (jsonLdData) {
    // Clear existing content
    this.innerHTML = ''

    // Create the container for the post
    const postContainer = document.createElement('div')
    postContainer.classList.add('distributed-post')

    // Header for the post, which will contain actor info and published time
    const postHeader = document.createElement('header')
    postHeader.classList.add('distributed-post-header')

    // Determine the source of 'attributedTo' based on the structure of jsonLdData
    let attributedToSource = jsonLdData.attributedTo
    if ('object' in jsonLdData && 'attributedTo' in jsonLdData.object) {
      attributedToSource = jsonLdData.object.attributedTo
    }

    // Create elements for each field, using the determined source for 'attributedTo'
    if (attributedToSource) {
      const actorInfo = document.createElement('actor-info')
      actorInfo.setAttribute('url', attributedToSource)
      postHeader.appendChild(actorInfo)
    }

    // Published time element
    const publishedTime = document.createElement('time')
    publishedTime.classList.add('time-ago')
    const elapsed = timeSince(jsonLdData.published)
    publishedTime.textContent = elapsed
    postHeader.appendChild(publishedTime)

    // Append the header to the post container
    postContainer.appendChild(postHeader)

    // Main content of the post
    const postContent = document.createElement('div')
    postContent.classList.add('post-content')

    // Determine content source based on structure of jsonLdData
    const contentSource = jsonLdData.content || (jsonLdData.object && jsonLdData.object.content)

    // Sanitize content and create a DOM from it
    const sanitizedContent = DOMPurify.sanitize(contentSource)
    const parser = new DOMParser()
    const contentDOM = parser.parseFromString(sanitizedContent, 'text/html')

    // Process all anchor elements
    const anchors = contentDOM.querySelectorAll('a')
    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href')
      // Logic to check if the href is an actor profile.
      if (href && href.endsWith('about.jsonld')) {
        anchor.setAttribute('href', `/profile.html?actor=${encodeURIComponent(href)}`)
      } else {
        // If not recognized, keep the original href
        anchor.setAttribute('href', href)
      }
    })

    // Determine if the content is marked as sensitive in either the direct jsonLdData or within jsonLdData.object
    const isSensitive =
      jsonLdData.sensitive ||
      (jsonLdData.object && jsonLdData.object.sensitive)

    const summary =
      jsonLdData.summary ||
      (jsonLdData.object && jsonLdData.object.summary)

    // Handle sensitive content
    if (isSensitive) {
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.classList.add('cw-summary')
      summary.textContent = 'Sensitive Content (click to view)'
      details.appendChild(summary)
      const content = document.createElement('p')
      content.innerHTML = DOMPurify.sanitize(contentSource)
      details.appendChild(content)
      postContent.appendChild(details)
    } else if (summary) {
      // Non-sensitive content with a summary (post title)
      const details = document.createElement('details')
      const summaryElement = document.createElement('summary')
      summaryElement.textContent = summary // Post title goes here
      details.appendChild(summaryElement)

      // Adding the "Show more" and "Show less" toggle text
      const toggleText = document.createElement('span')
      toggleText.textContent = 'Show more'
      toggleText.classList.add('see-more-toggle')
      summaryElement.appendChild(toggleText)

      const contentElement = document.createElement('p')
      contentElement.innerHTML = DOMPurify.sanitize(jsonLdData.content)
      details.appendChild(contentElement)
      postContent.appendChild(details)

      // Event listener to toggle the text of the Show more/Show less element
      details.addEventListener('toggle', function () {
        toggleText.textContent = details.open ? 'Show less' : 'Show more'
      })
    } else {
      const content = document.createElement('p')
      content.innerHTML = contentDOM.body.innerHTML
      postContent.appendChild(content)
    }

    // Append the content to the post container
    postContainer.appendChild(postContent)

    // Footer of the post, which will contain the full published date and platform
    const postFooter = document.createElement('footer')
    postFooter.classList.add('post-footer')
    const fullDate = document.createElement('div')
    fullDate.classList.add('full-date')
    fullDate.textContent = formatDate(jsonLdData.published) + ' · reader web'
    postFooter.appendChild(fullDate)

    // Append the footer to the post container
    postContainer.appendChild(postFooter)

    // Append the whole post container to the custom element
    this.appendChild(postContainer)
  }

  // appendField to optionally allow HTML content
  appendField (label, value, isHTML = false) {
    if (value) {
      const p = document.createElement('p')
      const strong = document.createElement('strong')
      strong.textContent = `${label}:`
      p.appendChild(strong)
      if (isHTML) {
        // If the content is HTML, set innerHTML directly
        const span = document.createElement('span')
        span.innerHTML = value
        p.appendChild(span)
      } else {
        // If not, treat it as text
        p.appendChild(document.createTextNode(` ${value}`))
      }
      this.appendChild(p)
    }
  }

  renderErrorContent (errorMessage) {
    // Clear existing content
    this.innerHTML = ''

    const errorComponent = document.createElement('error-message')
    errorComponent.setAttribute('message', errorMessage)
    this.appendChild(errorComponent)
  }
}

// Register the new element with the browser
customElements.define('distributed-post', DistributedPost)

// Define a class for the <actor-info> web component
class ActorInfo extends HTMLElement {
  static get observedAttributes () {
    return ['url']
  }

  constructor () {
    super()
    this.actorUrl = ''
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'url' && newValue) {
      this.actorUrl = newValue
      this.fetchAndRenderActorInfo(newValue)
    }
  }

  navigateToActorProfile () {
    window.location.href = `/profile.html?actor=${encodeURIComponent(this.actorUrl)}`
  }

  async fetchAndRenderActorInfo (url) {
    try {
      const actorInfo = await db.getActor(url)
      if (actorInfo) {
        // Clear existing content
        this.innerHTML = ''

        const author = document.createElement('div')
        author.classList.add('distributed-post-author')

        const authorDetails = document.createElement('div')
        authorDetails.classList.add('actor-details')

        // Handle both single icon object and array of icons
        let iconUrl = './assets/profile.png' // Default profile image path
        if (actorInfo.icon) {
          if (Array.isArray(actorInfo.icon) && actorInfo.icon.length > 0) {
            iconUrl = actorInfo.icon[0].url
          } else if (actorInfo.icon.url) {
            iconUrl = actorInfo.icon.url
          }
        }

        const img = document.createElement('img')
        img.classList.add('actor-icon')
        img.src = iconUrl
        img.alt = actorInfo.name ? actorInfo.name : 'Actor icon'
        img.addEventListener('click', this.navigateToActorProfile.bind(this))
        author.appendChild(img)

        if (actorInfo.name) {
          const pName = document.createElement('div')
          pName.classList.add('actor-name')
          pName.textContent = actorInfo.name
          pName.addEventListener('click', this.navigateToActorProfile.bind(this))
          authorDetails.appendChild(pName)
        }

        if (actorInfo.preferredUsername) {
          const pUserName = document.createElement('div')
          pUserName.classList.add('actor-username')
          pUserName.textContent = `@${actorInfo.preferredUsername}`
          authorDetails.appendChild(pUserName)
        }
        // Append the authorDetails to the author div
        author.appendChild(authorDetails)
        // Append the author container to the actor-info component
        this.appendChild(author)
      }
    } catch (error) {
      const errorElement = renderError(error.message)
      this.appendChild(errorElement)
    }
  }
}

// Register the new element with the browser
customElements.define('actor-info', ActorInfo)
