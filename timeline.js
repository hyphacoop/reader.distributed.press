import { ActivityPubDB } from "./db.js";

class ReaderTimeline extends HTMLElement {
  constructor() {
    super();
    // Default outbox URLs to fetch and display in the timeline
    this.outboxUrls = [
      "https://staticpub.mauve.moe/outbox.jsonld",
      "https://hypha.coop/outbox.jsonld",
    ];
  }

  connectedCallback() {
    this.initTimeline();
  }

  async initTimeline() {
    const db = await ActivityPubDB.load();

    // Clear existing content
    this.innerHTML = "";

    for (const outboxUrl of this.outboxUrls) {
      try {
        console.log("Ingesting actor from outbox URL:", outboxUrl);
        await db.ingestActor(outboxUrl);

        const outboxElement = document.createElement("distributed-outbox");
        outboxElement.setAttribute("url", outboxUrl);

        this.appendChild(outboxElement);
      } catch (error) {
        console.error(
          `Error ingesting actor from outbox URL ${outboxUrl}:`,
          error
        );
      }
    }
  }
}

// Register the reader-timeline element
customElements.define("reader-timeline", ReaderTimeline);
