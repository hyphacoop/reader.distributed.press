let sidebarTemplateContent

async function loadSidebarTemplate () {
  const response = await fetch('./sidebar.html')
  const text = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/html')
  sidebarTemplateContent = doc.getElementById('sidebar-template').content

  customElements.define('sidebar-nav', SidebarNav)
}

// Call the function to load the sidebar template immediately
loadSidebarTemplate()

class SidebarNav extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.initSidebar()
  }

  initSidebar () {
    // Use the pre-loaded sidebar template content
    if (sidebarTemplateContent) {
      const instance = sidebarTemplateContent.cloneNode(true)
      this.shadowRoot.appendChild(instance)

      // Attach the sidebar.css styles
      const style = document.createElement('style')
      style.textContent = '@import url("./sidebar.css");'
      this.shadowRoot.appendChild(style)
    } else {
      console.error('Sidebar template has not been loaded yet')
    }
  }
}
