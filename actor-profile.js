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
      this.updateFollowButtonState();
      // Update distributed-outbox URL based on fetched actorInfo
      const distributedOutbox = document.querySelector("distributed-outbox");
      distributedOutbox.setAttribute("url", actorInfo.outbox);
    }
  }

  renderActorProfile(actorInfo) {
    // Clear existing content
    this.innerHTML = "";

    const profileContainer = document.createElement("div");
    profileContainer.classList.add("actor-profile");

    // Create a container for the actor icon and name, to center them
    const actorContainer = document.createElement("div");
    actorContainer.classList.add("actor-container");

    // Handle both single icon object and array of icons
    let iconUrl = './assets/profile.png'; // Default profile image path
    if (actorInfo.icon) {
      if (Array.isArray(actorInfo.icon) && actorInfo.icon.length > 0) {
        iconUrl = actorInfo.icon[0].url;
      } else if (actorInfo.icon.url) {
        iconUrl = actorInfo.icon.url;
      }
    }
  
    const img = document.createElement("img");
    img.classList.add("actor-icon");
    img.src = iconUrl;
    img.alt = actorInfo.name ? actorInfo.name : "Actor icon";
    actorContainer.appendChild(img); // Append to the actor container

    if (actorInfo.name) {
      const pName = document.createElement("div");
      pName.classList.add("actor-name");
      pName.textContent = actorInfo.name;
      actorContainer.appendChild(pName); // Append to the actor container
    }

    // Append the actor container to the profile container
    profileContainer.appendChild(actorContainer);

    // Create and position the follow button
    const followButton = document.createElement("button");
    followButton.id = "followButton";
    followButton.textContent = "Follow";
    profileContainer.appendChild(followButton);

    // Append the profile container to the main component
    this.appendChild(profileContainer);
  }

  async updateFollowButtonState() {
    const followButton = this.querySelector("#followButton");
    const followedActors = await db.getFollowedActors();
    const isFollowed = followedActors.some((actor) => actor.url === this.url);

    followButton.textContent = isFollowed ? "Unfollow" : "Follow";
    followButton.className = isFollowed ? "unfollow" : "follow";
    followButton.onclick = async () => {
      if (isFollowed) {
        await db.unfollowActor(this.url);
      } else {
        await db.followActor(this.url);
      }
      this.updateFollowButtonState();
    };
  }
}

customElements.define("actor-profile", ActorProfile);
