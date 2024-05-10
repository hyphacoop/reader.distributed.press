import { db } from './dbInstance.js'

class ActorMiniProfile extends HTMLElement {
  static get observedAttributes () {
    return ['url']
  }

  constructor () {
    super()
    this.url = ''
  }

  connectedCallback () {
    this.url = this.getAttribute('url')
    this.fetchAndRenderActorInfo(this.url)
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'url' && newValue !== oldValue) {
      this.url = newValue
      this.fetchAndRenderActorInfo(this.url)
    }
  }

  async fetchAndRenderActorInfo (url) {
    try {
      const actorInfo = await db.getActor(url)
      if (actorInfo) {
        this.renderActorInfo(actorInfo)
      }
    } catch (error) {
      console.error('Error fetching actor info:', error)
    }
  }

  renderActorInfo (actorInfo) {
    // Clear existing content
    this.innerHTML = ''

    // Container for the icon and name, which should be a button for clickable actions
    const clickableContainer = document.createElement('button')
    clickableContainer.className = 'mini-profile'
    clickableContainer.setAttribute('type', 'button')

    let iconUrl = './assets/profile.png'
    if (actorInfo.icon) {
      iconUrl = actorInfo.icon.url || (Array.isArray(actorInfo.icon) ? actorInfo.icon[0].url : iconUrl)
    }

    // Actor icon
    const img = document.createElement('img')
    img.className = 'profile-mini-icon'
    img.src = iconUrl
    img.alt = actorInfo.name ? actorInfo.name : 'Actor icon'
    clickableContainer.appendChild(img)

    // Actor name
    if (actorInfo.name) {
      const pName = document.createElement('div')
      pName.classList.add('profile-mini-name')
      pName.textContent = actorInfo.name
      clickableContainer.appendChild(pName)
    }

    // Append the clickable container
    this.appendChild(clickableContainer)

    // Add click event to the clickable container for navigation
    clickableContainer.addEventListener('click', () => {
      window.location.href = `/profile.html?actor=${encodeURIComponent(this.url)}`
    })

    const pDate = document.createElement('span')
    pDate.classList.add('profile-followed-date')
    pDate.textContent = ` - Followed At: ${this.getAttribute('followed-at')}`
    this.appendChild(pDate)
  }
}

customElements.define('actor-mini-profile', ActorMiniProfile)
