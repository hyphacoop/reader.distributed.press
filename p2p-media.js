import { supportsP2P, resolveP2PUrl } from './db.js'

class P2PImage extends HTMLElement {
  constructor () {
    super()

    this.img = document.createElement('img')
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.appendChild(this.img)
    this.img.addEventListener('error', () => this.handleError())
  }

  static get observedAttributes () {
    return ['src']
  }

  connectedCallback () {
    if (this.hasAttribute('src')) {
      this.loadImage(this.getAttribute('src'))
    }
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.loadImage(newValue)
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

  async handleError () {
    const fallbackSrc = resolveP2PUrl(this.getAttribute('src'))
    console.log(`Failed to load image. Resolving to gateway URL: ${fallbackSrc}`)
    this.img.src = fallbackSrc
  }
}

customElements.define('p2p-image', P2PImage)

class P2PVideo extends HTMLElement {
  constructor () {
    super()
    this.video = document.createElement('video')
    this.video.controls = true
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.appendChild(this.video)
  }

  static get observedAttributes () {
    return ['src']
  }

  connectedCallback () {
    if (this.hasAttribute('src')) {
      this.loadVideo(this.getAttribute('src'))
    }
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.loadVideo(newValue)
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

  handleError (source) {
    const fallbackSrc = resolveP2PUrl(source.src)
    console.log(`Failed to load video source. Resolving to gateway URL: ${fallbackSrc}`)
    source.src = fallbackSrc
  }
}

customElements.define('p2p-video', P2PVideo)
