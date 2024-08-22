import { db } from './dbInstance.js'

class PostReplies extends HTMLElement {
  static get observedAttributes () {
    return ['url']
  }

  connectedCallback () {
    this.loadReplies(this.getAttribute('url'))
  }

  async loadReplies (postUrl) {
    const replies = []
    console.log('Loading replies for URL:', postUrl)

    try {
      // Get the main note
      const note = await db.getNote(postUrl)

      // Ingest the main note to ensure it's properly processed and stored
      await db.ingestNote(note)

      // Use searchNotes to get replies using inReplyTo
      for await (const reply of db.searchNotes({ inReplyTo: postUrl }, { limit: Infinity })) {
        replies.push(reply)
      }

      if (replies.length === 0) {
        console.log('No replies found for:', postUrl)
      } else {
        console.log(`Found ${replies.length} replies for ${postUrl}`, replies)
      }
    } catch (error) {
      console.error('Error loading replies:', error)
    }

    this.renderReplies(replies)
  }

  renderReplies (replies) {
    this.innerHTML = '' // Clear existing content
    if (replies.length > 0) {
      replies.forEach(reply => {
        const replyElement = document.createElement('distributed-post')
        replyElement.setAttribute('url', reply.id)
        this.appendChild(replyElement)
      })
    }
  }
}

customElements.define('post-replies', PostReplies)

class ReplyCount extends HTMLElement {
  static get observedAttributes () {
    return ['url']
  }

  connectedCallback () {
    this.loadReplyCount(this.getAttribute('url'))
  }

  async loadReplyCount (postUrl) {
    console.log('Loading reply count for URL:', postUrl)
    try {
      const count = await db.replyCount(postUrl)
      this.renderReplyCount(count, postUrl)
    } catch (error) {
      console.error('Error loading reply count:', error)
      this.renderReplyCount(0, postUrl)
    }
  }

  renderReplyCount (count, postUrl) {
    this.innerHTML = ''
    const replyCountElement = document.createElement('a')
    replyCountElement.classList.add('reply-count-link')
    replyCountElement.textContent = `${count} ${count === 1 ? 'reply' : 'replies'}`
    replyCountElement.href = `/post.html?url=${encodeURIComponent(postUrl)}&view=replies`
    this.appendChild(replyCountElement)
  }
}

customElements.define('reply-count', ReplyCount)
