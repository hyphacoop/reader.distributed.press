import { db } from './dbInstance.js'

let hasLoaded = false

class ReaderTimeline extends HTMLElement {
  connectedCallback () {
    this.initializeDefaultFollowedActors().then(() => this.initTimeline())
  }

  async initializeDefaultFollowedActors () {
    const defaultActors = [
      'https://social.dp.chanterelle.xyz/v1/@announcements@social.dp.chanterelle.xyz/',
      'https://hypha.coop/about.jsonld',
      'https://sutty.nl/about.jsonld'
      // "https://akhilesh.sutty.nl/about.jsonld",
      // "https://staticpub.mauve.moe/about.jsonld",
    ]

    // Check if followed actors have already been initialized
    const hasFollowedActors = await db.hasFollowedActors()
    if (!hasFollowedActors) {
      await Promise.all(
        defaultActors.map(async (actorUrl) => {
          await db.followActor(actorUrl)
        })
      )
    }
  }

  async initTimeline () {
    // Todo: Use filters from attributes
    // TODO: Use async iterator to render
    const allNotes = await db.searchNotes({})
    this.innerHTML = '' // Clear existing content

    for (const note of allNotes) {
      const activityElement = document.createElement('distributed-post')
      activityElement.setAttribute('url', note.id)
      this.appendChild(activityElement)
    }

    if (!hasLoaded) {
      hasLoaded = true
      // Dynamically load followed actors
      const followedActors = await db.getFollowedActors()

      await Promise.all(followedActors.map(({ url }) => db.ingestActor(url)))
      await this.initTimeline()
    }
  }
}

customElements.define('reader-timeline', ReaderTimeline)
