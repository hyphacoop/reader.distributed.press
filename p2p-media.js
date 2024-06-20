import { supportsP2P, resolveP2PUrl, isP2P } from './db.js'

class P2PImage extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })

    // Create an img element
    this.img = document.createElement('img')

    // Load the CSS file
    const style = document.createElement('style')
    fetch('./p2p-media.css').then(response => response.text()).then(css => {
      style.textContent = css
      this.shadowRoot.append(style, this.img)
    })

    this.img.addEventListener('error', () => this.handleError())
  }

  static get observedAttributes () {
    return ['src', 'class']
  }

  connectedCallback () {
    if (this.hasAttribute('src')) {
      this.loadImage(this.getAttribute('src'))
    }
    this.syncClass()
    this.addEventListener('load-error', e => {
      console.log(`Handled fallback for src: ${e.detail.fallbackSrc}`)
    })
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.loadImage(newValue)
      this.img.src = newValue // Ensure the inner image src is updated immediately
    } else if (name === 'class' && newValue !== oldValue) {
      this.syncClass()
    }
  }

  async loadImage (src) {
    try {
      const p2pSupported = await supportsP2P(src)
      if (p2pSupported) {
        this.img.src = src // Attempt to load the original P2P URL
      } else {
        this.handleError()
      }
    } catch (error) {
      this.handleError()
    }
  }

  syncClass () {
    const classes = this.className.split(' ')
    this.img.className = classes.join(' ')
  }

  handleError () {
    const src = this.getAttribute('src')
    if (isP2P(src)) {
      const fallbackSrc = resolveP2PUrl(src)
      console.log(`Failed to load, resolving to gateway URL: ${fallbackSrc}`)
      this.img.src = fallbackSrc
      this.setAttribute('src', fallbackSrc) // Update the attribute to the fallback source
      this.dispatchEvent(new CustomEvent('load-error', { detail: { fallbackSrc } }))
    }
  }
}

customElements.define('p2p-image', P2PImage)

class P2PVideo extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })

    // Create a video element
    this.video = document.createElement('video')
    this.video.controls = true

    // Load the CSS file
    const style = document.createElement('style')
    fetch('./p2p-media.css').then(response => response.text()).then(css => {
      style.textContent = css
      this.shadowRoot.append(style, this.video)
    })
  }

  static get observedAttributes () {
    return ['src', 'class']
  }

  connectedCallback () {
    if (this.hasAttribute('src')) {
      this.loadVideo(this.getAttribute('src'))
    }
    this.syncClass()
    this.addEventListener('load-error', e => {
      console.log(`Handled fallback for src: ${e.detail.fallbackSrc}`)
    })
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.loadVideo(newValue)
      this.video.src = newValue // Ensure the inner video src is updated immediately
    } else if (name === 'class' && newValue !== oldValue) {
      this.syncClass()
    }
  }

  async loadVideo (src) {
    this.video.innerHTML = '' // Clear any existing sources
    const source = document.createElement('source')
    source.src = src

    try {
      const p2pSupported = await supportsP2P(src)
      if (!p2pSupported) {
        throw new Error('P2P not supported for this URL')
      }
    } catch (error) {
      this.handleError(source)
      return // Skip setting the source if not supported
    }

    source.onerror = () => this.handleError(source)
    this.video.appendChild(source)
  }

  syncClass () {
    const classes = this.className.split(' ')
    this.video.className = classes.join(' ')
  }

  handleError (source) {
    const src = source.src
    if (isP2P(src)) {
      const fallbackSrc = resolveP2PUrl(src)
      console.log(`Failed to load video source. Resolving to gateway URL: ${fallbackSrc}`)
      source.src = fallbackSrc
      this.setAttribute('src', fallbackSrc) // Update the attribute to the fallback source
      this.dispatchEvent(new CustomEvent('load-error', { detail: { fallbackSrc } }))
    }
  }
}

customElements.define('p2p-video', P2PVideo)
