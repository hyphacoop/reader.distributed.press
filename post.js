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

  // TODO: Fetch actor info and render it
  // TODO: Refactor into reusable web component that takes the URL as an attribute
  // TODO: Factor out the avatar/profile name rendering into a separate component
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  let postUrl = urlParams.get("url");

  if (!postUrl) {
    // console.error('No post URL provided');
    postUrl =
      "ipfs://bafybeifslnipwp5uanmhkckokwuse7h5gfrrjzqq4jg5oxewxbzrdcdawu";
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
    renderPost(jsonLdData);
  } else {
    console.error("JSON-LD URL not found in the post");
  }
}
init();

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
