// theme-selector.js
import { db } from './dbInstance.js'
import { fetchDefaults } from './defaults.js'
import { defaultLightTheme } from './default-theme.js' // Import the default light theme

class ThemeSelector extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this.selectElement = document.createElement('select')
    this.selectElement.id = 'theme-select'
    this.selectElement.addEventListener('change', this.changeTheme.bind(this))

    const style = document.createElement('style')
    style.textContent = `
      select {
        padding: 2px;
        margin: 6px 0;
        border: 1px solid var(--rdp-border-color);
        border-radius: 4px;
        width: 120px;
      }
    `

    this.shadowRoot.appendChild(this.selectElement)
    this.shadowRoot.appendChild(style)
  }

  async connectedCallback () {
    // Append colorblind filters to the main document
    document.body.appendChild(this.createColorBlindFilters())

    const defaults = await fetchDefaults()
    const customTheme = defaults.theme || {}
    const isCustomDifferent = this.isThemeDifferent(customTheme, defaultLightTheme)

    // Build the select options based on theme comparison
    this.buildOptions(isCustomDifferent)

    // Get the current theme from the database
    const currentTheme = await db.getTheme() || (isCustomDifferent ? 'custom' : 'light')
    this.selectElement.value = currentTheme

    // Apply the current theme
    if (currentTheme === 'custom' && isCustomDifferent) {
      this.applyCustomTheme(customTheme)
    } else {
      this.applyTheme(currentTheme)
    }
  }

  isThemeDifferent (custom, defaultTheme) {
    // Compare each property; return true if any property differs
    for (const key in defaultTheme) {
      if (custom[key] !== defaultTheme[key]) {
        return true
      }
    }
    // Additionally, check if custom has extra properties
    for (const key in custom) {
      if (!(key in defaultTheme)) {
        return true
      }
    }
    return false
  }

  buildOptions (includeCustom) {
    // Clear existing options
    this.selectElement.innerHTML = ''

    // Standard Themes
    const standardGroup = document.createElement('optgroup')
    standardGroup.label = 'Standard Themes';
    ['light', 'dark'].forEach(text => {
      const option = document.createElement('option')
      option.value = text
      option.textContent = text.charAt(0).toUpperCase() + text.slice(1)
      standardGroup.appendChild(option)
    })

    // Conditionally add 'Custom' option
    if (includeCustom) {
      const customOption = document.createElement('option')
      customOption.value = 'custom'
      customOption.textContent = 'Custom'
      standardGroup.appendChild(customOption)
    }

    this.selectElement.appendChild(standardGroup)

    // Color Blind Themes
    const colorBlindGroup = document.createElement('optgroup')
    colorBlindGroup.label = 'Color Blind Themes';
    [
      { value: 'deuteranomaly', text: 'Deuteranomaly (Green-Weak)' },
      { value: 'protanomaly', text: 'Protanomaly (Red-Weak)' },
      { value: 'deuteranopia', text: 'Deuteranopia (Green-Blind)' },
      { value: 'protanopia', text: 'Protanopia (Red-Blind)' },
      { value: 'tritanopia', text: 'Tritanopia (Blue-Blind)' },
      { value: 'tritanomaly', text: 'Tritanomaly (Blue-Weak)' },
      { value: 'achromatopsia', text: 'Achromatopsia (All-Color-Blind)' }
    ].forEach(({ value, text }) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      colorBlindGroup.appendChild(option)
    })

    this.selectElement.appendChild(colorBlindGroup)
  }

  async changeTheme (event) {
    const newTheme = event.target.value
    await db.setTheme(newTheme)

    const defaults = await fetchDefaults()
    const customTheme = defaults.theme || {}
    const isCustomDifferent = this.isThemeDifferent(customTheme, defaultLightTheme)

    if (newTheme === 'custom' && isCustomDifferent) {
      this.applyCustomTheme(customTheme)
    } else {
      this.removeCustomTheme()
      this.applyTheme(newTheme)
    }
  }

  applyTheme (themeName) {
    document.documentElement.setAttribute('data-theme', themeName)
  }

  async applyCustomTheme (theme) {
    document.documentElement.setAttribute('data-theme', 'custom')

    // Create or update a <style id="custom-theme"> element
    let styleEl = document.getElementById('custom-theme')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'custom-theme'
      document.head.appendChild(styleEl)
    }

    const themeVars = []

    if (theme.bgColor) themeVars.push(`  --bg-color: ${theme.bgColor};`)
    if (theme.postBgColor) themeVars.push(`  --rdp-bg-color: ${theme.postBgColor};`)
    if (theme.postDetailsColor) themeVars.push(`  --rdp-details-color: ${theme.postDetailsColor};`)
    if (theme.postLinkColor) themeVars.push(`  --rdp-link-color: ${theme.postLinkColor};`)

    styleEl.textContent = `
:root[data-theme="custom"] {
${themeVars.join('\n')}
}
    `
  }

  removeCustomTheme () {
    const styleEl = document.getElementById('custom-theme')
    if (styleEl) {
      styleEl.parentNode.removeChild(styleEl)
    }
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

    filters.forEach(filter => {
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
