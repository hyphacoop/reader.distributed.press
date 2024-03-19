import DOMPurify from './dependencies/dompurify/purify.js'

const ACCEPT_HEADER =
  'application/activity+json, application/ld+json, application/json, text/html'

async function loadPost (url) {
  try {
    const headers = new Headers({ Accept: ACCEPT_HEADER })

    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    if (
      contentType.includes('application/ld+json') ||
      contentType.includes('application/activity+json') ||
      contentType.includes('application/json')
    ) {
      // Directly return JSON-LD if the response is JSON-LD or ActivityPub type
      return await response.json()
    } else if (contentType.includes('text/html')) {
      // For HTML responses, look for the link in the HTTP headers
      const linkHeader = response.headers.get('Link')
      if (linkHeader) {
        const matches = linkHeader.match(
          /<([^>]+)>;\s*rel="alternate";\s*type="application\/ld\+json"/
        )
        if (matches && matches[1]) {
          // Found JSON-LD link in headers, fetch that URL
          return fetchJsonLd(matches[1])
        }
      }
      // If no link header or alternate JSON-LD link is found, or response is HTML without JSON-LD link, process as HTML
      const htmlContent = await response.text()
      const jsonLdUrl = await parsePostHtml(htmlContent)
      if (jsonLdUrl) {
        // Found JSON-LD link in HTML, fetch that URL
        return fetchJsonLd(jsonLdUrl)
      }
      // No JSON-LD link found in HTML
      throw new Error('No JSON-LD link found in the response')
    }
  } catch (error) {
    console.error('Error fetching post:', error)
  }
}

async function parsePostHtml (htmlContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const alternateLink = doc.querySelector('link[rel="alternate"]')
  return alternateLink ? alternateLink.href : null
}

async function fetchJsonLd (jsonLdUrl) {
  try {
    const headers = new Headers({
      Accept: 'application/ld+json'
    })

    const response = await fetch(jsonLdUrl, { headers })
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching JSON-LD:', error)
  }
}

// async function loadPostFromIpfs(ipfsUrl) {
//   try {
//     // Try loading content using native IPFS URLs
//     const nativeResponse = await fetch(ipfsUrl);
//     if (nativeResponse.ok) {
//       return await nativeResponse.text();
//     }
//   } catch (error) {
//     console.log("Native IPFS loading failed, trying HTTP gateway:", error);
//   }

//   // Fallback to loading content via an HTTP IPFS gateway
//   const gatewayUrl = ipfsUrl.replace("ipfs://", "https://ipfs.hypha.coop/ipfs/");
//   try {
//     const gatewayResponse = await fetch(gatewayUrl);
//     if (!gatewayResponse.ok) {
//       throw new Error(`HTTP error! Status: ${gatewayResponse.status}`);
//     }
//     return await gatewayResponse.text();
//   } catch (error) {
//     console.error("Error fetching IPFS content via HTTP gateway:", error);
//   }
// }

// Function to load content from IPNS with fallback to the IPNS HTTP gateway
async function loadPostFromIpns (ipnsUrl) {
  try {
    const nativeResponse = await fetch(ipnsUrl)
    if (nativeResponse.ok) {
      return await nativeResponse.text()
    }
  } catch (error) {
    console.log('Native IPNS loading failed, trying HTTP gateway:', error)
  }

  // Fallback to loading content via an HTTP IPNS gateway
  const gatewayUrl = ipnsUrl.replace(
    'ipns://',
    'https://ipfs.hypha.coop/ipns/'
  )
  try {
    const gatewayResponse = await fetch(gatewayUrl)
    if (!gatewayResponse.ok) {
      throw new Error(`HTTP error! Status: ${gatewayResponse.status}`)
    }
    return await gatewayResponse.text()
  } catch (error) {
    console.error('Error fetching IPNS content via HTTP gateway:', error)
  }
}

// Function to load content from Hyper with fallback to the Hyper HTTP gateway
async function loadPostFromHyper (hyperUrl) {
  try {
    const nativeResponse = await fetch(hyperUrl)
    if (nativeResponse.ok) {
      return await nativeResponse.text()
    }
  } catch (error) {
    console.log('Native Hyper loading failed, trying HTTP gateway:', error)
  }

  // Fallback to loading content via an HTTP Hyper gateway
  const gatewayUrl = hyperUrl.replace(
    'hyper://',
    'https://hyper.hypha.coop/hyper/'
  )
  try {
    const gatewayResponse = await fetch(gatewayUrl)
    if (!gatewayResponse.ok) {
      throw new Error(`HTTP error! Status: ${gatewayResponse.status}`)
    }
    return await gatewayResponse.text()
  } catch (error) {
    console.error('Error fetching Hyper content via HTTP gateway:', error)
  }
}

export async function fetchActorInfo (actorUrl) {
  try {
    const response = await fetch(actorUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching actor info:', error)
  }
}

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

function renderError (message) {
  const errorElement = document.createElement('p')
  errorElement.classList.add('error')
  errorElement.textContent = message
  return errorElement
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
      // Check if the URL directly points to a JSON-LD document
      if (postUrl.endsWith('.jsonld')) {
        const jsonLdData = await fetchJsonLd(postUrl)
        this.renderPostContent(jsonLdData)
        return
      }

      // Handle different URL schemes and HTML content
      let content
      // if (postUrl.startsWith("ipfs://")) {
      //   content = await loadPostFromIpfs(postUrl);
      // }
      // Attempt to load content using native URLs or HTTP gateways based on the scheme
      if (postUrl.startsWith('ipns://')) {
        content = await loadPostFromIpns(postUrl)
      } else if (postUrl.startsWith('hyper://')) {
        content = await loadPostFromHyper(postUrl)
      } else if (postUrl.startsWith('https://')) {
        content = await loadPost(postUrl)
      } else {
        this.renderErrorContent('Unsupported URL scheme')
        return
      }

      // For HTML content, attempt to find and fetch JSON-LD link within the content
      if (typeof content === 'object' && !content.summary) {
        // Assuming JSON-LD content has a "summary" field
        this.renderPostContent(content)
      } else if (typeof content === 'string') {
        const jsonLdUrl = await parsePostHtml(content)
        if (jsonLdUrl) {
          const jsonLdData = await fetchJsonLd(jsonLdUrl)
          this.renderPostContent(jsonLdData)
        } else {
          this.renderErrorContent('JSON-LD URL not found in the post')
        }
      } else {
        this.renderErrorContent('Invalid content type')
      }
    } catch (error) {
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
    const contentSource =
      jsonLdData.content || (jsonLdData.object && jsonLdData.object.content)

    // Determine if the content is marked as sensitive in either the direct jsonLdData or within jsonLdData.object
    const isSensitive =
      jsonLdData.sensitive ||
      (jsonLdData.object && jsonLdData.object.sensitive)

    // Handle sensitive content
    if (isSensitive) {
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.textContent = 'Sensitive Content (click to view)'
      details.appendChild(summary)
      const content = document.createElement('p')
      content.innerHTML = DOMPurify.sanitize(contentSource)
      details.appendChild(content)
      postContent.appendChild(details)
    } else {
      const content = document.createElement('p')
      content.innerHTML = DOMPurify.sanitize(contentSource)
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

    const errorElement = document.createElement('p')
    errorElement.className = 'error'
    errorElement.textContent = errorMessage
    errorElement.style.color = 'red'
    this.appendChild(errorElement)
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
      const actorInfo = await fetchActorInfo(url)
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
