import './search.js'
import { applyDefaults } from './defaults.js'

// The version will now be fetched from the default.json file
const defaultJsonUrl = './config/defaults.json'

// GitHub Releases Page URL
const githubReleasesPage = 'https://github.com/hyphacoop/reader.distributed.press/releases'

async function fetchLocalVersion () {
  try {
    const response = await fetch(defaultJsonUrl)
    if (!response.ok) {
      throw new Error(`Error fetching defaults.json: ${response.statusText}`)
    }
    const defaults = await response.json()
    return defaults.version || 'Unknown Version'
  } catch (error) {
    console.error('Error fetching local version:', error)
    return 'Unknown Version'
  }
}

const response = await fetch('./sidebar.html')
const text = await response.text()
const template = document.createElement('template')
template.innerHTML = text

const style = document.createElement('style')
style.textContent = '@import url("./sidebar.css");'
document.head.appendChild(style)

class SidebarNav extends HTMLElement {
  constructor () {
    super()
    this.init()
  }

  async connectedCallback () {
    await applyDefaults()

    // Fetch the local version from defaults.json and display it in the sidebar
    const versionElement = this.querySelector('#release-version')
    if (versionElement) {
      const localVersion = await fetchLocalVersion()

      // Create the anchor element
      const versionLink = document.createElement('a')
      versionLink.href = githubReleasesPage
      versionLink.textContent = `${localVersion}`
      versionLink.target = '_blank' // Open in a new tab
      versionLink.rel = 'noopener noreferrer' // Security best practices

      // Clear any existing content and append the link
      versionElement.innerHTML = ''
      versionElement.appendChild(versionLink)
    }
  }

  init () {
    const instance = template.content.cloneNode(true)
    this.appendChild(instance)
  }
}

customElements.define('sidebar-nav', SidebarNav)
