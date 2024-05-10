import './search.js'

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

  init () {
    const instance = template.content.cloneNode(true)
    this.appendChild(instance)
  }
}

customElements.define('sidebar-nav', SidebarNav)
