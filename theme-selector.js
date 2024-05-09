import { db } from './dbInstance.js'

class ThemeSelector extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.appendChild(this.buildTemplate())
    this.shadowRoot.querySelector('#theme-select').addEventListener('change', this.changeTheme.bind(this))
  }

  async connectedCallback () {
    // Append colorblind filters to the main document
    document.body.appendChild(this.createColorBlindFilters())
    const currentTheme = await db.getTheme()
    this.shadowRoot.querySelector('#theme-select').value = currentTheme || 'light'
    this.applyTheme(currentTheme || 'light')
  }

  appendColorBlindFiltersToBody () {
    const existingSvg = document.querySelector('#colorblind-filters')
    if (!existingSvg) {
      document.body.appendChild(createColorBlindFilters())
    }
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
              padding: 2px;
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
      { value: '', text: '👁️ Color Blind Themes 👁️', disabled: true },
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

  createColorBlindFilters () {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('id', 'colorblind-filters')
    svg.setAttribute('style', 'display: none')

    const defs = document.createElementNS(svgNS, 'defs')

    const filters = [
      {
        id: 'deuteranopia',
        values: '0.29031,0.70969,0.00000,0,0 0.29031,0.70969,0.00000,0,0 -0.02197,0.02197,1.00000,0,0 0,0,0,1,0'
      },
      {
        id: 'deuteranomaly',
        values: '0.57418,0.42582,0.00000,0,0 0.17418,0.82582,0.00000,0,0 -0.01318,0.01318,1.00000,0,0 0,0,0,1,0'
      },
      {
        id: 'protanopia',
        values: '0.10889,0.89111,0.00000,0,0 0.10889,0.89111,0.00000,0,0 0.00447,-0.00447,1.00000,0,0 0,0,0,1,0'
      },
      {
        id: 'protanomaly',
        values: '0.46533,0.53467,0.00000,0,0 0.06533,0.93467,0.00000,0,0 0.00268,-0.00268,1.00000,0,0 0,0,0,1,0'
      },
      {
        id: 'tritanopia',
        values: '1.00000,0.15236,-0.15236,0,0 0.00000,0.86717,0.13283,0,0 0.00000,0.86717,0.13283,0,0 0,0,0,1,0'
      },
      {
        id: 'tritanomaly',
        values: '1.00000,0.09142,-0.09142,0,0 0.00000,0.92030,0.07970,0,0 0.00000,0.52030,0.47970,0,0 0,0,0,1,0'
      },
      {
        id: 'achromatopsia',
        values: '0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0,0,0,1,0'
      }
    ]

    // Iterate through each filter and append to defs
    filters.forEach((filter) => {
      const filterElem = document.createElementNS(svgNS, 'filter')
      filterElem.setAttribute('id', filter.id)
      filterElem.setAttribute('color-interpolation-filters', 'linearRGB')

      const feColorMatrix = document.createElementNS(svgNS, 'feColorMatrix')
      feColorMatrix.setAttribute('type', 'matrix')
      feColorMatrix.setAttribute('values', filter.values)

      filterElem.appendChild(feColorMatrix)
      defs.appendChild(filterElem)
    })

    svg.appendChild(defs)
    return svg
  }
}

customElements.define('theme-selector', ThemeSelector)
