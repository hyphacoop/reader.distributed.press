import { db } from './dbInstance.js'
import DOMPurify from './dependencies/dompurify/purify.js'

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
      // Check if the note has a replies collection and use it if available
      const note = await db.getNote(postUrl)
      if (note.replies && typeof note.replies === 'string') {
        for await (const reply of db.iterateRepliesCollection(note.replies)) {
          replies.push(reply)
        }
      } else {
        // Fallback to searchNotes with inReplyTo
        for await (const reply of db.searchNotes({ inReplyTo: postUrl })) {
          replies.push(reply)
        }
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
    if (replies.length === 0) {
      this.textContent = 'No replies'
    } else {
      replies.forEach(reply => {
        const replyElement = document.createElement('div')
        replyElement.innerHTML = DOMPurify.sanitize(reply.content)
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
    replyCountElement.textContent = `${count} replies`
    replyCountElement.href = `/post.html?url=${encodeURIComponent(postUrl)}&view=replies`
    this.appendChild(replyCountElement)
  }
}

customElements.define('reply-count', ReplyCount)
