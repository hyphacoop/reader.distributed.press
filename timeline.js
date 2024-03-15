import { db } from "./dbInstance.js";

class ReaderTimeline extends HTMLElement {
  constructor() {
    super();
    this.actorUrls = [
      "https://staticpub.mauve.moe/about.jsonld",
      "https://hypha.coop/about.jsonld",
      "https://prueba-cola-de-moderacion-2.sutty.nl/about.jsonld",
    ];
    this.processedNotes = new Set(); // To keep track of notes already processed
  }

  connectedCallback() {
    this.initTimeline();
  }

  async initTimeline() {
    this.innerHTML = ""; // Clear existing content

    for (const actorUrl of this.actorUrls) {
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
      // Sort all notes by published date in descending order
      allNotes.sort((a, b) => new Date(b.published) - new Date(a.published));

      // Create and append elements for each note
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
