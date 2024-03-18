import { db } from "./dbInstance.js";

class ReaderTimeline extends HTMLElement {
  constructor() {
    super();
    this.processedNotes = new Set(); // To keep track of already processed notes
  }

  connectedCallback() {
    this.initializeDefaultFollowedActors().then(() => this.initTimeline());
  }

  async initializeDefaultFollowedActors() {
    const defaultActors = [
      "https://social.dp.chanterelle.xyz/v1/@announcements@social.dp.chanterelle.xyz/",
      "https://hypha.coop/about.jsonld",
      "https://sutty.nl/about.jsonld",
      // "https://akhilesh.sutty.nl/about.jsonld",
      // "https://staticpub.mauve.moe/about.jsonld",
    ];

    // Check if followed actors have already been initialized
    const hasFollowedActors = await db.hasFollowedActors();
    if (!hasFollowedActors) {
      for (const actorUrl of defaultActors) {
        await db.followActor(actorUrl);
      }
    }
  }

  async initTimeline() {
    this.innerHTML = ""; // Clear existing content

    // Dynamically load followed actors
    const followedActors = await db.getFollowedActors();
    const actorUrls = followedActors.map(actor => actor.url);

    for (const actorUrl of actorUrls) {
      try {
        console.log("Loading actor:", actorUrl);
        await db.ingestActor(actorUrl);
      } catch (error) {
        console.error(`Error loading actor ${actorUrl}:`, error);
      }
    }

    // After ingesting all actors, search for all notes once
    try {
      const allNotes = await db.searchNotes({});
      allNotes.sort((a, b) => new Date(b.published) - new Date(a.published));

      allNotes.forEach((note) => {
        if (!this.processedNotes.has(note.id)) {
          const activityElement = document.createElement("distributed-post");
          activityElement.setAttribute("url", note.id);
          this.appendChild(activityElement);
          this.processedNotes.add(note.id); // Mark this note as processed
        }
      });
    } catch (error) {
      console.error(`Error retrieving notes:`, error);
    }
  }
}

customElements.define("reader-timeline", ReaderTimeline);
