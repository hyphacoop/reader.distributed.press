class SidebarNav extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })

    // Create sidebar container
    const sidebar = document.createElement('div')
    sidebar.classList.add('sidebar')

    // Branding
    const homePage = document.createElement('a')
    homePage.href = './'
    homePage.classList.add('home-page-link')
    const headerBranding = document.createElement('h1')
    headerBranding.classList.add('header-branding')
    headerBranding.textContent = 'Social Reader'
    homePage.appendChild(headerBranding)
    sidebar.appendChild(homePage)

    // Controls
    const controls = document.createElement('div')
    controls.classList.add('controls')
    const followingLink = document.createElement('a')
    followingLink.href = './followed-accounts.html'
    followingLink.textContent = 'Following · '

    const followedCount = document.createElement('followed-count')
    followingLink.appendChild(followedCount)

    controls.appendChild(followingLink)
    sidebar.appendChild(controls)

    // Navigation
    const nav = document.createElement('nav')
    const themeSelector = document.createElement('theme-selector')
    nav.appendChild(themeSelector)
    const links = [
      { href: './about.html', text: 'About' },
      {
        href: 'https://hypha.coop/dripline/announcing-dp-social-inbox/',
        text: 'Social Inbox'
      },
      { href: 'https://distributed.press', text: 'Distributed Press' }
    ]
    links.forEach((linkInfo) => {
      const a = document.createElement('a')
      a.href = linkInfo.href
      a.textContent = linkInfo.text
      nav.appendChild(a)
    })
    sidebar.appendChild(nav)

    // Append the sidebar to the shadow DOM
    this.shadowRoot.appendChild(sidebar)

    // Style
    const style = document.createElement('style')
    style.textContent = `     
    @import url("./sidebar.css");        
      `
    this.shadowRoot.appendChild(style)
  }
}

// Register the new element with the browser
customElements.define('sidebar-nav', SidebarNav)
