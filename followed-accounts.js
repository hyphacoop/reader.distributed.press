import { db } from './dbInstance.js'
import { applyDefaults } from './defaults.js'

export class FollowedActorsList extends HTMLElement {
  constructor () {
    super()
    this.updateFollowedActors = this.updateFollowedActors.bind(this)
  }

  async connectedCallback () {
    await applyDefaults()

    this.renderFollowedActors()

    db.addEventListener('actorFollowed', this.updateFollowedActors)
    db.addEventListener('actorUnfollowed', this.updateFollowedActors)

    this.addEventListener('exportFollowed', FollowedActorsList.exportFollowedList)
    this.addEventListener('importFollowed', (e) => {
      FollowedActorsList.importFollowedList(e.detail.file)
    })
  }

  disconnectedCallback () {
    db.removeEventListener('actorFollowed', this.updateFollowedActors)
    db.removeEventListener('actorUnfollowed', this.updateFollowedActors)

    this.removeEventListener('exportFollowed', FollowedActorsList.exportFollowedList)
    this.removeEventListener('importFollowed', FollowedActorsList.importFollowedList)
  }

  async updateFollowedActors () {
    await this.renderFollowedActors()
    const followCount = document.querySelector('followed-count')
    if (followCount) {
      followCount.updateCount()
    }
  }

  async renderFollowedActors () {
    const followedActors = await db.getFollowedActors()
    this.innerHTML = ''
    followedActors.forEach((actor) => {
      const actorElement = document.createElement('actor-mini-profile')
      actorElement.setAttribute('url', actor.url)
      actorElement.setAttribute('followed-at', this.formatDate(actor.followedAt))
      this.appendChild(actorElement)
    })
  }

  formatDate (dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' }
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
    }
    reader.readAsText(file)
  }
}

customElements.define('followed-actors-list', FollowedActorsList)

class FollowedCount extends HTMLElement {
  connectedCallback () {
    this.updateCountOnLoad()
    db.addEventListener('actorFollowed', () => this.updateCount())
    db.addEventListener('actorUnfollowed', () => this.updateCount())
  }

  disconnectedCallback () {
    db.removeEventListener('actorFollowed', () => this.updateCount())
    db.removeEventListener('actorUnfollowed', () => this.updateCount())
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
