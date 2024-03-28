import { db } from './dbInstance.js'

class ThemeSelector extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.appendChild(this.buildTemplate())
    this.shadowRoot.querySelector('#theme-select').addEventListener('change', this.changeTheme.bind(this))
  }

  async connectedCallback () {
    const currentTheme = await db.getTheme()
    this.shadowRoot.querySelector('#theme-select').value = currentTheme || 'light'
    this.applyTheme(currentTheme || 'light')
  }

  changeTheme (event) {
    const newTheme = event.target.value
    db.setTheme(newTheme)
    this.applyTheme(newTheme)
  }

  applyTheme (themeName) {
    document.documentElement.setAttribute('data-theme', themeName)
  }

  buildTemplate () {
    const template = document.createElement('template')

    const style = document.createElement('style')
    style.textContent = `
          select {
              padding: 4px;
              margin: 6px 0;
              border: 1px solid var(--rdp-border-color);
              border-radius: 4px;
              width: 60px;
          }
      `

    // Create the select element
    const select = document.createElement('select')
    select.id = 'theme-select'

    // Create and append the options
    const options = [
      { value: 'light', text: 'Light' },
      { value: 'dark', text: 'Dark' },
      { value: 'deuteranomaly', text: 'Deuteranomaly (Green-Weak)' },
      { value: 'protanomaly', text: 'Protanomaly (Red-Weak)' },
      { value: 'deuteranopia', text: 'Deuteranopia (Green-Blind)' },
      { value: 'protanopia', text: 'Protanopia (Red-Blind)' },
      { value: 'tritanopia', text: 'Tritanopia (Blue-Blind)' },
      { value: 'tritanomaly', text: 'Tritanomaly (Blue-Weak)' },
      { value: 'achromatopsia', text: 'Achromatopsia (All-Color-Blind)' }
    ]

    // Create and append the options
    options.forEach(({ value, text }) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      select.appendChild(option)
    })

    // Append the select & style to the template's content
    template.content.appendChild(select)
    template.content.appendChild(style)

    return template.content
  }
}

customElements.define('theme-selector', ThemeSelector)
