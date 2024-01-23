async function loadPost(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error fetching post:", error);
  }
}

async function parsePostHtml(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const alternateLink = doc.querySelector('link[rel="alternate"]');
  return alternateLink ? alternateLink.href : null;
}

async function fetchJsonLd(jsonLdUrl) {
  try {
    const response = await fetch(jsonLdUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching JSON-LD:", error);
  }
}

function renderPost(jsonLdData) {
  const postContainer = document.getElementById("post-container");
  let contentHtml = "";

  // Display actorInfo
  if (jsonLdData.attributedTo) {
    // Use the actor-info web component
    contentHtml += `<actor-info url="${jsonLdData.attributedTo}"></actor-info>`;
  }

  // Render the main fields
  contentHtml += jsonLdData.summary
    ? `<p><strong>Summary:</strong> ${jsonLdData.summary}</p>`
    : "";
  contentHtml += jsonLdData.published
    ? `<p><strong>Published:</strong> ${jsonLdData.published}</p>`
    : "";
  contentHtml += jsonLdData.attributedTo
    ? `<p><strong>Author:</strong> ${jsonLdData.attributedTo}</p>`
    : "";
  contentHtml += jsonLdData.content
    ? `<p><strong>Content:</strong> ${jsonLdData.content}</p>`
    : "";

  // Handle sensitive content
  if (jsonLdData.sensitive) {
    contentHtml += `
        <details>
          <summary>Sensitive Content (click to view)</summary>
          <p>${jsonLdData.sensitive}</p>
        </details>
      `;
  }

  postContainer.innerHTML = contentHtml;
}

async function loadPostFromIpfs(ipfsUrl) {
  try {
    // Try loading content using native IPFS URLs
    const nativeResponse = await fetch(ipfsUrl);
    if (nativeResponse.ok) {
      return await nativeResponse.text();
    }
  } catch (error) {
    console.log("Native IPFS loading failed, trying HTTP gateway:", error);
  }

  // Fallback to loading content via an HTTP IPFS gateway
  const gatewayUrl = ipfsUrl.replace("ipfs://", "https://dweb.link/ipfs/");
  try {
    const gatewayResponse = await fetch(gatewayUrl);
    if (!gatewayResponse.ok) {
      throw new Error(`HTTP error! Status: ${gatewayResponse.status}`);
    }
    return await gatewayResponse.text();
  } catch (error) {
    console.error("Error fetching IPFS content via HTTP gateway:", error);
  }
}

async function fetchActorInfo(actorUrl) {
  try {
    const response = await fetch(actorUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching actor info:", error);
  }
}

// Define a class for the <distributed-post> web component
class DistributedPost extends HTMLElement {
  static get observedAttributes() {
    return ["url"];
  }

  connectedCallback() {
    this.loadAndRenderPost(this.getAttribute("url"));
  }

  async loadAndRenderPost(postUrl) {
    if (!postUrl) {
      console.error("No post URL provided");
      return;
    }

    let htmlContent;
    if (postUrl.startsWith("ipfs://")) {
      htmlContent = await loadPostFromIpfs(postUrl);
    } else {
      htmlContent = await loadPost(postUrl);
    }

    const jsonLdUrl = await parsePostHtml(htmlContent);
    if (jsonLdUrl) {
      const jsonLdData = await fetchJsonLd(jsonLdUrl);
      this.innerHTML = renderPost(jsonLdData);
    } else {
      console.error("JSON-LD URL not found in the post");
    }
  }
}

// Register the new element with the browser
customElements.define("distributed-post", DistributedPost);

// Define a class for the <actor-info> web component
class ActorInfo extends HTMLElement {
  static get observedAttributes() {
    return ["url"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "url" && newValue) {
      this.fetchAndRenderActorInfo(newValue);
    }
  }

  async fetchAndRenderActorInfo(url) {
    const actorInfo = await fetchActorInfo(url);
    if (actorInfo) {
      // Render the actor's avatar and name
      this.innerHTML = `<p>${actorInfo.name}</p><img src="${actorInfo.icon[0].url}" width="69" alt="${actorInfo.name}" /><p>${actorInfo.summary}</p>`;
    }
  }
}

// Register the new element with the browser
customElements.define("actor-info", ActorInfo);
