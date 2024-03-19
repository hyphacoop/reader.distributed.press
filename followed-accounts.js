import { db } from "./dbInstance.js";

class FollowedActorsList extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.renderFollowedActors();
  }

  async renderFollowedActors() {
    const followedActors = await db.getFollowedActors();
    this.innerHTML = followedActors
      .map((actor) => {
        const formattedDate = this.formatDate(actor.followedAt);
        return `<div>- Followed URL: ${actor.url} - Followed At: ${formattedDate}</div>`;
      })
      .join("");
  }

  formatDate(dateString) {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    };
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", options);
  }
}

customElements.define("followed-actors-list", FollowedActorsList);

class FollowedCount extends HTMLElement {
  connectedCallback() {
    this.updateCountOnLoad();
  }

  async updateCountOnLoad() {
    setTimeout(() => this.updateCount(), 100);
  }

  async updateCount() {
    const followedActors = await db.getFollowedActors();
    this.textContent = followedActors.length;
  }
}

customElements.define("followed-count", FollowedCount);

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
