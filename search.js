import { db } from './dbInstance.js'

const response = await fetch('./search-template.html')
const text = await response.text()
const template = document.createElement('template')
template.innerHTML = text

const style = document.createElement('style')
style.textContent = '@import url("./search.css");'
document.head.appendChild(style)

class DistributedSearch extends HTMLElement {
  constructor () {
    super()
    this.init()
  }

  get form () {
    return this.querySelector('form')
  }

  get url () {
    return this.querySelector('[name=url]').value
  }

  init () {
    const instance = template.content.cloneNode(true)
    this.appendChild(instance)

    this.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSubmit(e)
    })
  }

  async handleSubmit () {
    // TODO: Detect `@username@domain syntax
    const url = this.url
    try {
      // TODO: Redirect to p2p version
      const data = await db.resolveURL(url)
      const { id, type } = data

      if (type === 'Person' || type === 'Service') {
        const newURL = new URL('/profile.html', window.location.href)
        newURL.searchParams.set('actor', id)
        window.location.href = newURL.href
      } else if (type === 'Note') {
        const newURL = new URL('/post.html', window.location.href)
        newURL.searchParams.set('url', id)
        window.location.href = newURL.href
      } else {
        throw new Error(`Invalid JSON-LD type: ${type}`)
      }
    } catch (e) {
      this.showError(e)
    }
  }

  showError (e) {
    console.error(e)
    const element = document.createElement('error-message')
    element.setAttribute('message', e.message)

    this.appendChild(element)
  }
}

customElements.define('distributed-search', DistributedSearch)
