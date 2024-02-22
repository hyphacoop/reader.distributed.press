class DistributedOutbox extends HTMLElement {
  constructor() {
    super();
    this.renderedItems = new Map(); // Tracks rendered items by ID
    this.numPosts = 32; // Default value
    this.page = 1; // Default value
    this.totalPages = 0; // Keep track of total pages
  }

  static get observedAttributes() {
    return ["url", "num-posts", "page"];
  }

  connectedCallback() {
    // Use attributes or default values
    this.numPosts =
      parseInt(this.getAttribute("num-posts"), 10) || this.numPosts;
    this.page = parseInt(this.getAttribute("page"), 10) || this.page;
    this.loadOutbox(this.getAttribute("url"));
  }

  async loadOutbox(outboxUrl) {
    this.clearContent();
    for await (const item of this.fetchOutboxItems(outboxUrl)) {
      const itemKey = item.object;
      if (itemKey === undefined) {
        console.error("Item key (object property) is undefined, item:", item);
        continue; // Skip this item
      }
      if (!this.renderedItems.has(itemKey)) {
        this.renderItem(item);
        // Mark as rendered by adding to the Map
        this.renderedItems.set(itemKey, item);
        // console.log(`Rendered item with key: ${itemKey}`);
      }
      // else {
      //   console.log(`Duplicate item with key: ${itemKey} skipped`);
      // }
    }
  }

  async *fetchOutboxItems(outboxUrl) {
    if (!outboxUrl) {
      console.error("No outbox URL provided");
      return;
    }

    try {
      const response = await fetch(outboxUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const outboxData = await response.json();

      this.totalPages = Math.ceil(
        outboxData.orderedItems.length / this.numPosts
      );
      // Prevent page number from going beyond total pages
      this.page = Math.min(this.page, this.totalPages);

      // Simulate pagination by slicing the items array
      const startIndex = (this.page - 1) * this.numPosts;
      const endIndex = startIndex + this.numPosts;
      const paginatedItems = outboxData.orderedItems.slice(
        startIndex,
        endIndex
      );

      for (const item of paginatedItems) {
        yield item;
      }
    } catch (error) {
      console.error("Error fetching outbox:", error);
    }
  }

  renderItem(item) {
    const activityElement = document.createElement("distributed-activity");
    activityElement.type = item.type;
    activityElement.data = item;
    this.appendChild(activityElement);
  }

  nextPage() {
    const currentPage = this.page;
    if (currentPage < this.totalPages) {
      this.setAttribute("page", currentPage + 1);
    }
  }

  prevPage() {
    const currentPage = this.page;
    this.setAttribute("page", Math.max(1, currentPage - 1));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "url") {
      this.clearContent();
      this.loadOutbox(newValue);
    } else if (name === "num-posts" || name === "page") {
      // Convert attribute name from kebab-case to camelCase
      const propName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      this[propName] = parseInt(newValue, 10);
      this.clearContent();
      this.loadOutbox(this.getAttribute("url"));
    }
  }

  clearContent() {
    // Clear existing content
    this.innerHTML = "";
    this.renderedItems.clear();
  }
}

// Register the new element with the browser
customElements.define("distributed-outbox", DistributedOutbox);

class DistributedActivity extends HTMLElement {
  constructor() {
    super();
    this.activityType = "";
    this.activityData = {};
    this.activityUrl = null;
  }

  static get observedAttributes() {
    return ["type", "data", "url"];
  }

  async connectedCallback() {
    // Check if the component already has type and data set as properties
    if (this.type && this.data) {
      this.activityType = this.type;
      this.activityData = this.data;
      this.renderActivity();
    }
    // Load from URL if type and data are not set
    else if (this.activityUrl) {
      await this.loadDataFromUrl(this.activityUrl);
    } else {
      console.error("Activity data is not provided and no URL is specified.");
    }
  }

  async loadDataFromUrl(activityUrl) {
    try {
      const response = await fetch(activityUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const activityData = await response.json();
      this.type = activityData.type;
      this.data = activityData;
      this.connectedCallback();
    } catch (error) {
      console.error("Error loading activity data from URL:", error);
    }
  }

  async fetchAndDisplayPost(postUrl) {
    try {
      const response = await fetch(postUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const postData = await response.json();
      this.displayPostContent(postData.content);
    } catch (error) {
      console.error("Error fetching post content:", error);
    }
  }

  displayPostContent(content) {
    // Clear existing content
    this.innerHTML = "";

    const postUrl = this.activityData.object;
    // Create and append the distributed-post component
    const distributedPostElement = document.createElement("distributed-post");
    distributedPostElement.setAttribute("url", postUrl);
    this.appendChild(distributedPostElement);
  }

  renderActivity() {
    // Clear existing content
    this.innerHTML = "";

    switch (this.activityType) {
      case "Create":
        this.fetchAndDisplayPost(this.activityData.object);
        break;
      case "Follow":
        this.displayFollowActivity();
        break;
      case "Like":
        this.displayLikeActivity();
        break;
      default:
        const message = `Activity type ${this.activityType} is not implemented yet.`;
        const messageElement = document.createElement("p");
        messageElement.textContent = message;
        this.appendChild(messageElement);
        break;
    }
  }

  displayFollowActivity() {
    const message = `New follow request from ${this.activityData.actor}`;
    const messageElement = document.createElement("p");
    messageElement.textContent = message;
    this.appendChild(messageElement);
  }

  displayLikeActivity() {
    const message = `New like on ${this.activityData.object}`;
    const messageElement = document.createElement("p");
    messageElement.textContent = message;
    this.appendChild(messageElement);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (newValue !== oldValue) {
      if (name === "type") {
        this.activityType = newValue;
        this.renderActivity();
      } else if (name === "data") {
        this.activityData = JSON.parse(newValue);
        this.renderActivity();
      } else if (name === "url") {
        this.loadDataFromUrl(newValue)
          .then(() => {
            this.renderActivity();
          })
          .catch((error) => {
            console.error("Error loading activity data from URL:", error);
          });
      }
    }
  }
}

// Register the new element with the browser
customElements.define("distributed-activity", DistributedActivity);
