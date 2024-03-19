import { db } from "./dbInstance.js";

class ActorProfile extends HTMLElement {
  static get observedAttributes() {
    return ["url"];
  }

  constructor() {
    super();
    this.url = "";
  }

  connectedCallback() {
    this.url = this.getAttribute("url");
    this.fetchAndRenderActorProfile(this.url);
  }

  async fetchAndRenderActorProfile(url) {
    const actorInfo = await db.getActor(url);
    console.log(actorInfo);
    if (actorInfo) {
      this.renderActorProfile(actorInfo);
    }
  }

  renderActorProfile(actorInfo) {
    // Clear existing content
    this.innerHTML = "";

    const profileContainer = document.createElement("div");
    profileContainer.classList.add("profile");

    // Create a container for the actor icon and name, to center them
    const actorContainer = document.createElement("div");
    actorContainer.classList.add("profile-container");

    // Handle both single icon object and array of icons
    let iconUrl = "./assets/profile.png"; // Default profile image path
    if (actorInfo.icon) {
      if (Array.isArray(actorInfo.icon) && actorInfo.icon.length > 0) {
        iconUrl = actorInfo.icon[0].url;
      } else if (actorInfo.icon.url) {
        iconUrl = actorInfo.icon.url;
      }
    }

    const img = document.createElement("img");
    img.classList.add("profile-icon");
    img.src = iconUrl;
    img.alt = actorInfo.name ? actorInfo.name : "Actor icon";
    actorContainer.appendChild(img); // Append to the actor container

    if (actorInfo.name) {
      const pName = document.createElement("div");
      pName.classList.add("profile-name");
      pName.textContent = actorInfo.name;
      actorContainer.appendChild(pName); // Append to the actor container
    }

    // Instead of creating a button, create a FollowButton component
    const followButton = document.createElement("follow-button");
    followButton.setAttribute("url", this.url);
    actorContainer.appendChild(followButton);

    // Append the actor container to the profile container
    profileContainer.appendChild(actorContainer);

    // Create the distributed-outbox component and append it to the profile container
    const distributedOutbox = document.createElement("distributed-outbox");
    profileContainer.appendChild(distributedOutbox);

    // Append the profile container to the main component
    this.appendChild(profileContainer);

    // Update distributed-outbox URL based on fetched actorInfo
    this.querySelector("distributed-outbox").setAttribute(
      "url",
      actorInfo.outbox
    );
  }
}

customElements.define("actor-profile", ActorProfile);

class FollowButton extends HTMLElement {
  static get observedAttributes() {
    return ["url"];
  }

  constructor() {
    super();
    this.url = this.getAttribute("url") || "";
    this.state = "unknown";
  }

  connectedCallback() {
    this.updateState();
    this.render();
    this.addEventListener("click", this.toggleFollowState.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "url" && newValue !== oldValue) {
      this.url = newValue;
      this.updateState();
    }
  }

  async updateState() {
    const isFollowed = await db.isActorFollowed(this.url);
    this.state = isFollowed ? "unfollow" : "follow";
    this.render();
  }

  async toggleFollowState() {
    if (this.state === "follow") {
      await db.followActor(this.url);
    } else if (this.state === "unfollow") {
      await db.unfollowActor(this.url);
    }
    this.updateState();
  }

  render() {
    this.textContent = this.state === "follow" ? "Follow" : "Unfollow";
    this.setAttribute("state", this.state);
  }
}

customElements.define("follow-button", FollowButton);
