import DOMPurify from "./dependencies/dompurify/purify.js";

const ACCEPT_HEADER =
  "application/activity+json, application/ld+json, application/json, text/html";

async function loadPost(url) {
  try {
    const headers = new Headers({ Accept: ACCEPT_HEADER });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (
      contentType.includes("application/ld+json") ||
      contentType.includes("application/activity+json") ||
      contentType.includes("application/json")
    ) {
      // Directly return JSON-LD if the response is JSON-LD or ActivityPub type
      return await response.json();
    } else if (contentType.includes("text/html")) {
      // For HTML responses, look for the link in the HTTP headers
      const linkHeader = response.headers.get("Link");
      if (linkHeader) {
        const matches = linkHeader.match(
          /<([^>]+)>;\s*rel="alternate";\s*type="application\/ld\+json"/
        );
        if (matches && matches[1]) {
          // Found JSON-LD link in headers, fetch that URL
          return fetchJsonLd(matches[1]);
        }
      }
      // If no link header or alternate JSON-LD link is found, or response is HTML without JSON-LD link, process as HTML
      const htmlContent = await response.text();
      const jsonLdUrl = await parsePostHtml(htmlContent);
      if (jsonLdUrl) {
        // Found JSON-LD link in HTML, fetch that URL
        return fetchJsonLd(jsonLdUrl);
      }
      // No JSON-LD link found in HTML
      throw new Error("No JSON-LD link found in the response");
    }
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
    const headers = new Headers({
      Accept: "application/ld+json",
    });

    const response = await fetch(jsonLdUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching JSON-LD:", error);
  }
}

// async function loadPostFromIpfs(ipfsUrl) {
//   try {
//     // Try loading content using native IPFS URLs
//     const nativeResponse = await fetch(ipfsUrl);
//     if (nativeResponse.ok) {
//       return await nativeResponse.text();
//     }
//   } catch (error) {
//     console.log("Native IPFS loading failed, trying HTTP gateway:", error);
//   }

//   // Fallback to loading content via an HTTP IPFS gateway
//   const gatewayUrl = ipfsUrl.replace("ipfs://", "https://ipfs.hypha.coop/ipfs/");
//   try {
//     const gatewayResponse = await fetch(gatewayUrl);
//     if (!gatewayResponse.ok) {
//       throw new Error(`HTTP error! Status: ${gatewayResponse.status}`);
//     }
//     return await gatewayResponse.text();
//   } catch (error) {
//     console.error("Error fetching IPFS content via HTTP gateway:", error);
//   }
// }

// Function to load content from IPNS with fallback to the IPNS HTTP gateway
async function loadPostFromIpns(ipnsUrl) {
  try {
    const nativeResponse = await fetch(ipnsUrl);
    if (nativeResponse.ok) {
      return await nativeResponse.text();
    }
  } catch (error) {
    console.log("Native IPNS loading failed, trying HTTP gateway:", error);
  }

  // Fallback to loading content via an HTTP IPNS gateway
  const gatewayUrl = ipnsUrl.replace(
    "ipns://",
    "https://ipfs.hypha.coop/ipns/"
  );
  try {
    const gatewayResponse = await fetch(gatewayUrl);
    if (!gatewayResponse.ok) {
      throw new Error(`HTTP error! Status: ${gatewayResponse.status}`);
    }
    return await gatewayResponse.text();
  } catch (error) {
    console.error("Error fetching IPNS content via HTTP gateway:", error);
  }
}

// Function to load content from Hyper with fallback to the Hyper HTTP gateway
async function loadPostFromHyper(hyperUrl) {
  try {
    const nativeResponse = await fetch(hyperUrl);
    if (nativeResponse.ok) {
      return await nativeResponse.text();
    }
  } catch (error) {
    console.log("Native Hyper loading failed, trying HTTP gateway:", error);
  }

  // Fallback to loading content via an HTTP Hyper gateway
  const gatewayUrl = hyperUrl.replace(
    "hyper://",
    "https://hyper.hypha.coop/hyper/"
  );
  try {
    const gatewayResponse = await fetch(gatewayUrl);
    if (!gatewayResponse.ok) {
      throw new Error(`HTTP error! Status: ${gatewayResponse.status}`);
    }
    return await gatewayResponse.text();
  } catch (error) {
    console.error("Error fetching Hyper content via HTTP gateway:", error);
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

function renderError(message) {
  const errorElement = document.createElement("p");
  errorElement.classList.add("error");
  errorElement.textContent = message;
  return errorElement;
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
      this.renderErrorContent("No post URL provided");
      return;
    }

    try {
      // Check if the URL directly points to a JSON-LD document
      if (postUrl.endsWith(".jsonld")) {
        const jsonLdData = await fetchJsonLd(postUrl);
        this.renderPostContent(jsonLdData);
        return;
      }

      // Handle different URL schemes and HTML content
      let content;
      // if (postUrl.startsWith("ipfs://")) {
      //   content = await loadPostFromIpfs(postUrl);
      // }
      // Attempt to load content using native URLs or HTTP gateways based on the scheme
      if (postUrl.startsWith("ipns://")) {
        content = await loadPostFromIpns(postUrl);
      } else if (postUrl.startsWith("hyper://")) {
        content = await loadPostFromHyper(postUrl);
      } else if (postUrl.startsWith("https://")) {
        content = await loadPost(postUrl);
      } else {
        this.renderErrorContent("Unsupported URL scheme");
        return;
      }

      // For HTML content, attempt to find and fetch JSON-LD link within the content
      if (typeof content === "object" && !content.summary) {
        // Assuming JSON-LD content has a "summary" field
        this.renderPostContent(content);
      } else if (typeof content === "string") {
        const jsonLdUrl = await parsePostHtml(content);
        if (jsonLdUrl) {
          const jsonLdData = await fetchJsonLd(jsonLdUrl);
          this.renderPostContent(jsonLdData);
        } else {
          this.renderErrorContent("JSON-LD URL not found in the post");
        }
      } else {
        this.renderErrorContent("Invalid content type");
      }
    } catch (error) {
      this.renderErrorContent(error.message);
    }
  }

  renderPostContent(jsonLdData) {
    // Clear existing content
    this.innerHTML = "";

    // Determine the source of 'attributedTo' based on the structure of jsonLdData
    let attributedToSource = jsonLdData.attributedTo;
    if ("object" in jsonLdData && "attributedTo" in jsonLdData.object) {
      attributedToSource = jsonLdData.object.attributedTo;
    }

    // Create elements for each field, using the determined source for 'attributedTo'
    if (attributedToSource) {
      const actorInfo = document.createElement("actor-info");
      actorInfo.setAttribute("url", attributedToSource);
      this.appendChild(actorInfo);
    }

    this.appendField("Published", jsonLdData.published);
    this.appendField("Author", attributedToSource);

    // Determine content source based on structure of jsonLdData
    let contentSource = jsonLdData.content;
    if ("object" in jsonLdData && "content" in jsonLdData.object) {
      contentSource = jsonLdData.object.content;
    }

    // Handle sensitive content
    if (jsonLdData.sensitive) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Sensitive Content (click to view)";
      details.appendChild(summary);
      const content = document.createElement("p");

      // Sanitize contentSource before displaying
      const sanitizedContent = DOMPurify.sanitize(contentSource);
      content.innerHTML = sanitizedContent;

      details.appendChild(content);
      this.appendChild(details);
    } else {
      // If not sensitive, display content as usual but sanitize first
      this.appendField("Content", DOMPurify.sanitize(contentSource), true);
    }
  }

  // appendField to optionally allow HTML content
  appendField(label, value, isHTML = false) {
    if (value) {
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}:`;
      p.appendChild(strong);
      if (isHTML) {
        // If the content is HTML, set innerHTML directly
        const span = document.createElement("span");
        span.innerHTML = value;
        p.appendChild(span);
      } else {
        // If not, treat it as text
        p.appendChild(document.createTextNode(` ${value}`));
      }
      this.appendChild(p);
    }
  }

  renderErrorContent(errorMessage) {
    // Clear existing content
    this.innerHTML = "";

    const errorElement = document.createElement("p");
    errorElement.className = "error";
    errorElement.textContent = errorMessage;
    this.appendChild(errorElement);
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
    try {
      const actorInfo = await fetchActorInfo(url);
      if (actorInfo) {
        // Clear existing content
        this.innerHTML = "";

        if (actorInfo.name) {
          const pName = document.createElement("p");
          pName.textContent = actorInfo.name;
          this.appendChild(pName);
        }

        // Handle both single icon object and array of icons
        let iconUrl = null;
        if (actorInfo.icon) {
          if (Array.isArray(actorInfo.icon) && actorInfo.icon.length > 0) {
            // Assume first icon if array
            iconUrl = actorInfo.icon[0].url;
          } else if (actorInfo.icon.url) {
            // Directly use the URL if object
            iconUrl = actorInfo.icon.url;
          }

          if (iconUrl) {
            const img = document.createElement("img");
            img.src = iconUrl;
            img.width = 69;
            img.alt = actorInfo.name ? actorInfo.name : "Actor icon";
            this.appendChild(img);
          }
        }
      }
    } catch (error) {
      const errorElement = renderError(error.message);
      this.appendChild(errorElement);
    }
  }
}

// Register the new element with the browser
customElements.define("actor-info", ActorInfo);
