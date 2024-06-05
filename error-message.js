class ErrorMessage extends HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })

    // Create the main element for the error message
    const errorElement = document.createElement('p')
    errorElement.classList.add('error')
    errorElement.textContent =
      this.getAttribute('message') || 'An error occurred'

    const style = document.createElement('style')
    style.textContent = `
        .error {
          color: var(--rdp-details-color);
          text-align: center;
          margin: 20px;
          font-size: 1rem;
          border: 1px solid var(--rdp-border-color);
          border-radius: 4px;
          padding: 6px;
        }
      `

    this.shadowRoot.append(style, errorElement)
  }

  static get observedAttributes () {
    return ['message']
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (name === 'message' && oldValue !== newValue) {
      this.shadowRoot.querySelector('.error').textContent = newValue
    }
  }
}

customElements.define('error-message', ErrorMessage)
