import { db } from './dbInstance.js'

export async function fetchDefaults () {
  const response = await fetch('./config/defaults.json')
  if (!response.ok) {
    throw new Error('Failed to load defaults.')
  }
  return await response.json()
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

    // Apply theme if available
    if (defaults.theme) {
      applyTheme(defaults.theme)
    }
  } catch (error) {
    console.error('Error loading defaults: ', error)
  }
}

function applyTheme (theme) {
  const root = document.documentElement
  if (theme.bgColor) root.style.setProperty('--bg-color', theme.bgColor)
  if (theme.postBgColor) root.style.setProperty('--rdp-bg-color', theme.postBgColor)
  if (theme.postDetailsColor) root.style.setProperty('--rdp-details-color', theme.postDetailsColor)
  if (theme.postLinkColor) root.style.setProperty('--rdp-link-color', theme.postLinkColor)
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
