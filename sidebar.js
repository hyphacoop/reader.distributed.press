let sidebarTemplateContent

const response = await fetch('./sidebar.html')
const text = await response.text()
const template = document.createElement('template')
template.innerHTML = text

const style = document.createElement('style')
style.textContent = '@import url("./sidebar.css");'
template.content.appendChild(style)

sidebarTemplateContent = template.content

class SidebarNav extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.initSidebar()
  }

  initSidebar () {
    const instance = sidebarTemplateContent.cloneNode(true)
    this.shadowRoot.appendChild(instance)

    // Attach the sidebar.css styles
    const style = document.createElement('style')
    style.textContent = '@import url("./sidebar.css");'
    this.shadowRoot.appendChild(style)
  }
}

customElements.define('sidebar-nav', SidebarNav)
