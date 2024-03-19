class DistributedOutbox extends HTMLElement {
  constructor() {
    super();
    this.renderedItems = new Map(); // Tracks rendered items by ID
    this.numPosts = 1; // Default value
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
      this.processItem(item);
    }
  }

  processItem(item) {
    const itemKey = item.id || item.object;
    if (!itemKey) {
      console.error("Item key is undefined, item:", item);
      return;
    }
    if (!this.renderedItems.has(itemKey)) {
      this.renderItem(item);
      this.renderedItems.set(itemKey, true);
    }
  }

  async *fetchOutboxItems(outboxUrl) {
    if (!outboxUrl) {
      console.error("No outbox URL provided");
      return;
    }

    try {
      let response;
      // Check the scheme and adjust the URL for unsupported schemes before fetching
      if (outboxUrl.startsWith("hyper://")) {
        const gatewayUrl = outboxUrl.replace(
          "hyper://",
          "https://hyper.hypha.coop/hyper/"
        );
        response = await fetch(gatewayUrl);
      } else if (outboxUrl.startsWith("ipns://")) {
        const gatewayUrl = outboxUrl.replace(
          "ipns://",
          "https://ipfs.hypha.coop/ipns/"
        );
        response = await fetch(gatewayUrl);
      } else {
        response = await fetch(outboxUrl);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const outbox = await response.json();

      // Adjust for both direct items and items loaded via URLs
      const items = [];
      for (const itemOrUrl of outbox.orderedItems) {
        if (typeof itemOrUrl === "string") {
          // URL to an activity
          const itemResponse = await fetch(itemOrUrl);
          if (itemResponse.ok) {
            const item = await itemResponse.json();
            items.push(item);
          }
        } else {
          items.push(itemOrUrl); // Directly included activity
        }
      }

      this.totalPages = Math.ceil(items.length / this.numPosts);
      this.page = Math.min(this.page, this.totalPages);

      // Calculate the range of items to be loaded based on the current page and numPosts
      const startIndex = (this.page - 1) * this.numPosts;
      const endIndex = startIndex + this.numPosts;
      const itemsToLoad = items.slice(startIndex, endIndex);

      for (const item of itemsToLoad) {
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

  async fetchAndDisplayPost() {
    let postUrl;
    // Determine the source of the post (direct activity or URL pointing to the activity)
    const isDirectPost =
      typeof this.activityData.object === "string" ||
      this.activityData.object instanceof String;

    if (isDirectPost) {
      postUrl = this.activityData.object;
    } else if (this.activityData.object && this.activityData.object.id) {
      postUrl = this.activityData.id;
    } else {
      postUrl = this.activityData.object;
    }

    try {
      const response = await fetch(postUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const postData = await response.json();
      // Determine how to extract content based on the post source
      const content = isDirectPost ? postData.content : postData.object.content;
      this.displayPostContent(content, postUrl);
    } catch (error) {
      console.error("Error fetching post content:", error);
    }
  }

  displayPostContent(content, url) {
    // Clear existing content
    this.innerHTML = "";

    // Create and append the distributed-post component
    const distributedPostElement = document.createElement("distributed-post");
    distributedPostElement.setAttribute("url", url);
    this.appendChild(distributedPostElement);
  }

  fetchAndUpdatePost(activityData) {
    let postUrl;
    // Determine the source of the post (direct activity or URL pointing to the activity)
    const isDirectUpdate =
      typeof activityData.object === "string" ||
      activityData.object instanceof String;

    if (isDirectUpdate) {
      // If it's a direct update, use the URL from the 'object' property
      postUrl = activityData.object;
    } else if (activityData.object && activityData.object.id) {
      // If the 'object' property contains an 'id', use it as the URL
      postUrl = activityData.object.id;
    } else {
      // Otherwise, use the 'id' property of the activityData itself
      postUrl = activityData.id;
    }

    this.fetchAndDisplayPost(postUrl);
  }

  renderActivity() {
    // Clear existing content
    this.innerHTML = "";

    switch (this.activityType) {
      case "Create":
        this.fetchAndDisplayPost();
        break;
      case "Update":
        this.fetchAndUpdatePost(this.activityData);
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
    const from = this.activityData.actor;
    const to = this.activityData.object;
    const message = `New follow request from ${from} to ${to}`;
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
