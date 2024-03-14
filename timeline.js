import { db } from "./dbInstance.js";

class ReaderTimeline extends HTMLElement {
  constructor() {
    super();
    this.actorUrls = [
      "https://staticpub.mauve.moe/about.jsonld",
      "https://hypha.coop/about.jsonld",
      "https://prueba-cola-de-moderacion-2.sutty.nl/about.jsonld",
    ];
  }

  connectedCallback() {
    this.initTimeline();
  }

  async initTimeline() {
    this.innerHTML = ""; // Clear existing content

    for (const actorUrl of this.actorUrls) {
      try {
        console.log("Loading actor:", actorUrl);
        const actorData = await db.ingestActor(actorUrl);
        const notes = await db.searchNotes({ attributedTo: actorData });

        notes.forEach((note) => {
          console.log(note.id);
          const activityElement = document.createElement("distributed-post");
          activityElement.setAttribute("url", note.id);
          this.appendChild(activityElement);
        });
      } catch (error) {
        console.error(`Error loading actor ${actorUrl}:`, error);
      }
    }
  }
}

customElements.define("reader-timeline", ReaderTimeline);
