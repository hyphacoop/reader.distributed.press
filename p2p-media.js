import { supportsP2P, resolveP2PUrl, isP2P } from './db.js'

function addStylesheet () {
  if (!document.getElementById('p2p-media-styles')) {
    const style = document.createElement('link')
    style.id = 'p2p-media-styles'
    style.rel = 'stylesheet'
    style.href = './p2p-media.css'
    document.head.appendChild(style)
  }
}

class P2PImage extends HTMLElement {
  constructor () {
    super()
    this.img = document.createElement('img')
    addStylesheet()
  }

  static get observedAttributes () {
    return ['src', 'class']
  }

  connectedCallback () {
    this.attachImage()
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.attachImage(newValue)
    } else if (name === 'class' && newValue !== oldValue) {
      this.syncClass()
    }
  }

  async attachImage (src) {
    try {
      src = src || this.getAttribute('src')
      const p2pSupported = await supportsP2P(src)
      if (p2pSupported) {
        this.img.src = src
      } else {
        this.handleError(src)
      }
    } catch (error) {
      this.handleError(src)
    }
    this.syncClass()
    this.clearAndAppend(this.img)
  }

  syncClass () {
    const classes = this.className.split(' ')
    this.img.className = classes.join(' ')
  }

  handleError (src) {
    const fallbackSrc = isP2P(src) ? resolveP2PUrl(src) : './assets/profile.png'
    this.img.src = fallbackSrc
    this.setAttribute('src', fallbackSrc)
    this.dispatchEvent(new CustomEvent('load-error', { detail: { fallbackSrc } }))
  }

  clearAndAppend (element) {
    this.innerHTML = ''
    this.appendChild(element)
  }
}

class P2PVideo extends HTMLElement {
  constructor () {
    super()
    this.video = document.createElement('video')
    this.video.controls = true
    addStylesheet()
  }

  static get observedAttributes () {
    return ['src', 'class']
  }

  connectedCallback () {
    this.attachVideo()
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'src' && newValue !== oldValue) {
      this.attachVideo(newValue)
    } else if (name === 'class' && newValue !== oldValue) {
      this.syncClass()
    }
  }

  async attachVideo (src) {
    this.video.innerHTML = '' // Clear any existing sources
    const source = document.createElement('source')
    source.src = src || this.getAttribute('src')

    try {
      const p2pSupported = await supportsP2P(source.src)
      if (!p2pSupported) {
        this.handleError(source)
        return
      }
    } catch (error) {
      this.handleError(source)
      return
    }

    source.onerror = () => this.handleError(source)
    this.video.appendChild(source)
    this.syncClass()
    this.clearAndAppend(this.video)
  }

  syncClass () {
    const classes = this.className.split(' ')
    this.video.className = classes.join(' ')
  }

  handleError (source) {
    const src = source.src
    if (isP2P(src)) {
      const fallbackSrc = resolveP2PUrl(src)
      source.src = fallbackSrc
      this.setAttribute('src', fallbackSrc)
      this.dispatchEvent(new CustomEvent('load-error', { detail: { fallbackSrc } }))
    }
  }

  clearAndAppend (element) {
    this.innerHTML = ''
    this.appendChild(element)
  }
}

customElements.define('p2p-image', P2PImage)
customElements.define('p2p-video', P2PVideo)
