/* global customElements, HTMLElement */
import DOMPurify from './dependencies/dompurify/purify.js'
import { db } from './dbInstance.js'
import { resolveP2PUrl, isP2P } from './db.js'

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

function insertImagesAndVideos (content) {
  const parser = new DOMParser()
  const contentDOM = parser.parseFromString(content, 'text/html')

  // Replace all <img> tags with <p2p-image> tags
  contentDOM.querySelectorAll('img').forEach(img => {
    const originalSrc = img.getAttribute('src')
    console.log(`Original img src: ${originalSrc}`)
    const p2pImg = document.createElement('p2p-image')
    p2pImg.setAttribute('src', originalSrc)
    img.parentNode.replaceChild(p2pImg, img)
    console.log(`Replaced img with p2p-image having src: ${p2pImg.getAttribute('src')}`)
  })

  // Replace all <video> tags with <p2p-video> tags
  contentDOM.querySelectorAll('video').forEach(video => {
    const p2pVideo = document.createElement('p2p-video')
    if (video.hasAttribute('src')) {
      const originalSrc = video.getAttribute('src')
      p2pVideo.setAttribute('src', originalSrc)
    }
    Array.from(video.children).forEach(source => {
      if (source.tagName === 'SOURCE') {
        const originalSrc = source.getAttribute('src')
        console.log(`Original video src: ${originalSrc}`)
        const srcType = source.getAttribute('type')
        const p2pSource = document.createElement('source')
        p2pSource.setAttribute('src', originalSrc)
        p2pSource.setAttribute('type', srcType)
        p2pVideo.appendChild(p2pSource)
        console.log(`Replaced video with p2p-video having src: ${p2pSource.getAttribute('src')}`)
      }
    })
    video.parentNode.replaceChild(p2pVideo, video)
  })

  return contentDOM.body.innerHTML
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
      if (content && content.content) {
        content.content = insertImagesAndVideos(content.content) // Resolve URLs before rendering
        // Assuming JSON-LD content has a "summary" field
        this.renderPostContent(content)
      }
    } catch (error) {
      console.error(error)
      this.renderErrorContent(error.message)
    }
  }

  async renderPostContent (jsonLdData) {
    // Clear existing content
    this.innerHTML = ''

    // Check if jsonLdData is an activity instead of a note
    if ('object' in jsonLdData) {
      this.renderErrorContent('Expected a Note but received an Activity')
      return
    }

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
    const publishedTime = document.createElement('a')
    publishedTime.href = `/post.html?url=${encodeURIComponent(db.getObjectPage(jsonLdData))}`
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

    const sanitizedContent = DOMPurify.sanitize(contentSource)
    const parser = new DOMParser()
    const contentDOM = parser.parseFromString(sanitizedContent, 'text/html')

    // Process all anchor elements to handle actor and posts mentions
    const anchors = contentDOM.querySelectorAll('a')
    anchors.forEach(async (anchor) => {
      const href = anchor.getAttribute('href')
      if (href) {
        const fediverseActorMatch = href.match(/^(https?|ipns|hyper):\/\/([^\/]+)\/@(\w+)$/)
        const jsonldActorMatch = href.endsWith('about.jsonld')
        const mastodonPostMatch = href.match(/^(https?|ipns|hyper):\/\/([^\/]+)\/@(\w+)\/(\d+)$/)
        const jsonldPostMatch = href.endsWith('.jsonld')

        if (fediverseActorMatch || jsonldActorMatch) {
          anchor.setAttribute('href', `/profile.html?actor=${encodeURIComponent(href)}`)
          try {
            const actorData = await db.getActor(href)
            if (actorData) {
              anchor.setAttribute('href', `/profile.html?actor=${encodeURIComponent(href)}`)
            } else {
              console.log('Actor not found in DB, default redirection applied.')
            }
          } catch (error) {
            console.error('Error fetching actor data:', error)
          }
        } else if (mastodonPostMatch || jsonldPostMatch) {
          anchor.setAttribute('href', `/post.html?url=${encodeURIComponent(href)}`)
          try {
            const noteData = await db.getNote(href)
            if (noteData) {
              anchor.setAttribute('href', `/post.html?url=${encodeURIComponent(href)}`)
            } else {
              console.log('Post not found in DB, default redirection applied.')
            }
          } catch (error) {
            console.error('Error fetching note data:', error)
          }
        } else {
          anchor.setAttribute('href', href)
        }
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

    // Footer of the post, which will contain the full published date and platform, but only the date is clickable
    const postFooter = document.createElement('footer')
    postFooter.classList.add('post-footer')

    // Create a container for the full date and additional text
    const dateContainer = document.createElement('div')

    // Create the clickable link for the date
    const fullDateLink = document.createElement('a')
    fullDateLink.href = `/post.html?url=${encodeURIComponent(jsonLdData.id)}`
    fullDateLink.classList.add('full-date')
    fullDateLink.textContent = formatDate(jsonLdData.published)
    dateContainer.appendChild(fullDateLink)

    // Add the ' · reader web' text outside of the link
    const readerWebText = document.createElement('span')
    readerWebText.textContent = ' · reader web'
    dateContainer.appendChild(readerWebText)

    // Append the date container to the footer
    postFooter.appendChild(dateContainer)

    // Handle attachments of other Fedi instances
    if (!isSensitive && !jsonLdData.summary && jsonLdData.attachment && jsonLdData.attachment.length > 0) {
      const attachmentsContainer = document.createElement('div')
      attachmentsContainer.className = 'attachments-container'

      jsonLdData.attachment.forEach(attachment => {
        if (attachment.mediaType.startsWith('image/')) {
          // If it's an image
          const img = document.createElement('img')
          img.src = attachment.url
          img.alt = attachment.name || 'Attached image'
          img.className = 'attachment-image'
          attachmentsContainer.appendChild(img)
        } else if (attachment.mediaType.startsWith('video/')) {
          // If it's a video
          const video = document.createElement('video')
          video.src = attachment.url
          video.alt = attachment.name || 'Attached video'
          video.className = 'attachment-video'
          video.controls = true
          attachmentsContainer.appendChild(video)
        }
      })
      postContainer.appendChild(attachmentsContainer)
    }

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
    url = await resolveP2PUrl(url)
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
            iconUrl = actorInfo.icon[0].url || actorInfo.id
          } else if (actorInfo.icon.url) {
            iconUrl = actorInfo.icon.url || actorInfo.id
          }
        }

        const img = document.createElement('img')
        img.classList.add('actor-icon')
        img.src = resolveP2PUrl(iconUrl)
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
