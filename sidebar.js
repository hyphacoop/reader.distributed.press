class SidebarNav extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.initSidebar()
  }

  async initSidebar () {
    const response = await fetch('./sidebar.html')
    const text = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')
    const template = doc.getElementById('sidebar-template')

    const instance = template.content.cloneNode(true)
    this.shadowRoot.appendChild(instance)

    const style = document.createElement('style')
    style.textContent = `
          @import url("./sidebar.css");
      `
    this.shadowRoot.appendChild(style)
  }
}

customElements.define('sidebar-nav', SidebarNav)
