import { db } from './dbInstance.js'
import { defaultLightTheme } from './default-theme.js'

export async function fetchDefaults () {
  try {
    const response = await fetch('./config/defaults.json')
    if (!response.ok) {
      throw new Error('Failed to load defaults.')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching defaults:', error)
    return {}
  }
}

export async function applyDefaults () {
  try {
    const defaults = await fetchDefaults()

    // Apply community name if available
    if (defaults.communityName) {
      document.title = defaults.communityName // Update the main title
      const brandingElement = document.getElementById('header-branding') // Update sidebar branding
      if (brandingElement) {
        brandingElement.textContent = defaults.communityName
      }
    }

    // Check if a theme is already set in the DB
    const currentTheme = await db.getTheme()
    if (currentTheme) {
      // Theme is already set by the user; do not override
      return
    }

    // Determine if the custom theme differs from the default light theme
    const customTheme = defaults.theme || {}
    const isCustomDifferent = isThemeDifferent(customTheme, defaultLightTheme)

    // Apply custom theme if available and different
    if (isCustomDifferent) {
      await db.setTheme('custom') // Set the theme to custom if not already set
      applyCustomTheme(customTheme)
    } else {
      await db.setTheme('light') // Ensure the theme is set to light
      applyTheme('light')
    }
  } catch (error) {
    console.error('Error applying defaults:', error)
  }
}

function isThemeDifferent (custom, defaultTheme) {
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

function applyTheme (themeName) {
  const root = document.documentElement
  root.setAttribute('data-theme', themeName)
}

async function applyCustomTheme (theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', 'custom')

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

export async function initializeDefaultFollowedActors () {
  const hasFollowedActors = await db.hasFollowedActors()

  if (!hasFollowedActors) {
    try {
      const defaults = await fetchDefaults()
      const defaultActors = defaults.defaultFollowedActors || []

      // Follow default actors from the loaded configuration
      await Promise.all(defaultActors.map((actorUrl) => db.followActor(actorUrl)))
    } catch (error) {
      console.error('Error loading default followed actors: ', error)
    }
  }
}
