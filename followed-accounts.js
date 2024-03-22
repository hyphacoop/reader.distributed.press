import { db } from './dbInstance.js'

class FollowedActorsList extends HTMLElement {
  constructor () {
    super()
  }

  connectedCallback () {
    this.renderFollowedActors()

    window.addEventListener(
      'exportFollowed',
      FollowedActorsList.exportFollowedList
    )

    window.addEventListener('importFollowed', (e) => {
      FollowedActorsList.importFollowedList(e.detail.file)
    })

    // Listen for the custom event to refresh the list and count
    window.addEventListener('followedActorsUpdated', async () => {
      await this.renderFollowedActors()
      document.getElementById('followCount').updateCountOnLoad()
    })
  }

  disconnectedCallback () {
    window.removeEventListener(
      'exportFollowed',
      FollowedActorsList.exportFollowedList
    )
    window.removeEventListener(
      'importFollowed',
      FollowedActorsList.importFollowedList
    )
    window.removeEventListener(
      'followedActorsUpdated',
      this.renderFollowedActors
    )
  }

  async renderFollowedActors () {
    const followedActors = await db.getFollowedActors()
    this.innerHTML = ''
    followedActors.forEach((actor) => {
      const actorElement = document.createElement('div')
      const formattedDate = this.formatDate(actor.followedAt)

      actorElement.innerText = `- Followed URL: ${actor.url} - Followed At: ${formattedDate}`

      this.appendChild(actorElement)
    })
  }

  formatDate (dateString) {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', options)
  }

  static async exportFollowedList () {
    const followedActors = await db.getFollowedActors()
    const blob = new Blob([JSON.stringify(followedActors, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reader-followed-accounts.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  static async importFollowedList (file) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const followedActors = JSON.parse(e.target.result)
      for (const actor of followedActors) {
        if (!(await db.isActorFollowed(actor.url))) {
          await db.followActor(actor.url)
        }
      }
      // After import, dispatch a custom event to notify the component
      window.dispatchEvent(new CustomEvent('followedActorsUpdated'))
    }
    reader.readAsText(file)
  }
}

customElements.define('followed-actors-list', FollowedActorsList)

class FollowedCount extends HTMLElement {
  connectedCallback () {
    this.updateCountOnLoad()
  }

  async updateCountOnLoad () {
    setTimeout(() => this.updateCount(), 100)
  }

  async updateCount () {
    const followedActors = await db.getFollowedActors()
    this.textContent = followedActors.length
  }
}

customElements.define('followed-count', FollowedCount)

// test following/unfollowing
// (async () => {
//   const actorUrl1 = "https://example.com/actor/1";
//   const actorUrl2 = "https://example.com/actor/2";

//   console.log("Following actors...");
//   await db.followActor(actorUrl1);
//   await db.followActor(actorUrl2);

//   console.log("Retrieving followed actors...");
//   let followedActors = await db.getFollowedActors();
//   console.log("Followed Actors:", followedActors);

//   console.log("Unfollowing an actor...");
//   await db.unfollowActor(actorUrl2);

//   console.log("Retrieving followed actors after unfollowing...");
//   followedActors = await db.getFollowedActors();
//   console.log("Followed Actors after unfollowing:", followedActors);
// })();
