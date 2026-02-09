/**
 * ReactiveHTML v2
 * - Auto-render on data change (batched via microtask)
 * - Parent waits for child custom elements (whenDefined) before postRender
 * - whenReady() bootstrap; $rel.slots fix
 */

function emitEvent (eventName, data) {
  if (eventName in this.$rel.events) {
    this.$rel.events[eventName](data)
  } else {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail: {
        caller: this.getAttribute('rhtml-id'),
        data,
        props: this.$rel.props
      },
      bubbles: true,
      composed: true
    }))
  }
}

function scheduleRender (instance) {
  if (instance.$rel.renderScheduled) return
  instance.$rel.renderScheduled = true
  queueMicrotask(() => {
    instance.$rel.renderScheduled = false
    instance.render()
  })
}

class ReactiveHTMLElement extends HTMLElement {
  $rel = {
    data: {},
    dom: null,
    emitEvent: emitEvent.bind(this),
    events: {},
    methods: {},
    props: {},
    template: null,
    templateFunction: null,
    triggers: [],
    ignoreUpdate: false,
    slots: [],
    renderScheduled: false
  }
  constructor (options) {
    super()
    this.setAttribute('rhtml-id', crypto.randomUUID())
    if (this.hasAttribute('id')) {
      this.id = this.getAttribute('id')
      this.$rel.id = this.id
    }
    this.attachShadow({ mode: 'open' })
    this.$rel.dom = this.shadowRoot
    if (Array.isArray(options.triggers)) this.$rel.triggers = options.triggers
    if (typeof options.onCreate == 'function') {
      this.$rel.onCreate = options.onCreate.bind(this.$rel)
      this.$rel.onCreate()
    }
    if (typeof options.preRender == 'function') {
      this.$rel.preRender = options.preRender.bind(this.$rel)
    }
    if (typeof options.postRender == 'function') {
      this.$rel.postRender = options.postRender.bind(this.$rel)
    }
    if (typeof options.propsUpdate == 'function') {
      this.$rel.propsUpdate = options.propsUpdate.bind(this.$rel)
    }
    if (options.methods) {
      Object.entries(options.methods).forEach(([name, method]) => {
        if (typeof method == 'function') this.$rel.methods[name] = method.bind(this.$rel)
      })
    }
    if (typeof options.template == 'function') {
      const tokens = options.template.toString().split('`')
      tokens.splice(0, 1)
      tokens.pop()
      this.$rel.template = tokens.join('')
      this.$rel.templateFunction = options.template.bind(this.$rel)
    }
    if (options.props && options.props.length > 0) {
      options.props.forEach((attribute) => {
        const value = this.parseAttributeValue(this.getAttribute(`:${attribute}`))
        const prop = this.prepName(`:${attribute}`)
        this.$rel.props[prop] = value
      })
    }

    if (options.data && typeof options.data === 'object' && Object.keys(options.data).length > 0) {
      this.$rel.data = new Proxy(options.data, {
        set: (target, dataProp, newValue) => {
          if (dataProp in target && newValue != null && typeof newValue !== 'function') {
            if (typeof newValue === 'object') {
              const newObject = Object.assign({}, newValue)
              const oldObject = Object.assign({}, target[dataProp])
              if (JSON.stringify(oldObject) !== JSON.stringify(newObject)) {
                target[dataProp] = newObject
                scheduleRender(this)
              }
            } else if (target[dataProp] !== newValue) {
              target[dataProp] = newValue
              scheduleRender(this)
            }
          }
          return true
        },
        get: (target, dataProp) => {
          if (dataProp in target) return target[dataProp]
          return undefined
        }
      })
    }

    if (options.name) this.$rel.name = options.name

    this.getAttributeNames()
      .filter((attribute) => attribute.includes('@'))
      .forEach((attribute) => {
        if (this.hasAttribute(attribute)) {
          const handler = this.getAttribute(attribute)
          const event = this.prepName(attribute)
          const customEventFunction = (data) => {
            this.dispatchEvent(new CustomEvent(event, {
              detail: {
                caller: this.getAttribute('rhtml-id'),
                data,
                handler,
                props: this.$rel.props
              },
              bubbles: true,
              composed: true
            }))
          }
          this.$rel.events[event] = customEventFunction
        }
      })

    const slotsElements = this.querySelectorAll('[slot]')
    if (slotsElements.length > 0) {
      Array.from(slotsElements).forEach((slotsElement) => {
        if (!this.$rel.slots.includes(slotsElement.slot)) {
          this.$rel.slots.push(slotsElement.slot)
        }
      })
    }

    this.$rel.observer = new MutationObserver((mutations) => {
      if (mutations.length > 0) {
        this.removeExternalListeners()
        this.removeInternalListeners()
        this.setExternalListeners()
        this.setInternalListeners()
        this.removeCustomAttributes()
      }
    })
    this.$rel.observer.observe(this.$rel.dom, {
      attributes: false,
      childList: true,
      subtree: true
    })
    this.render()
    console.dir(this)
  }

  _customElementsCollector (element, collection = []) {
    const elements = Array.from(element.querySelectorAll('*')).filter((el) => el.tagName.includes('-'))
    if (elements.length > 0) {
      elements.forEach((child) => {
        if (child.tagName.includes('-')) {
          collection.push(child)
          if (child.shadowRoot) {
            this._customElementsCollector(child.shadowRoot, collection)
          }
        }
      })
    }
    return collection
  }

  _encodeAttributeValue (value) {
    if (value == null) return ''
    if (typeof value === 'string') {
      return 'urienc' + encodeURIComponent(value)
    }
    return 'urienc' + encodeURIComponent(JSON.stringify(value))
  }

  _eventHandler (e) {
    if (e.detail.caller !== this.getAttribute('rhtml-id') && e.detail.handler) {
      if (e.detail.handler in this) {
        e.stopPropagation()
        this.$rel.methods[e.detail.handler](e.detail.data, {
          ...e.detail.props,
          caller: e.detail.caller
        })
      }
    }
  }

  _getCustomElementTags (root) {
    const tags = new Set()
    const walk = (node) => {
      if (node.tagName && node.tagName.includes('-')) {
        tags.add(node.tagName.toLowerCase())
      }
      Array.from(node.children || []).forEach(walk)
      if (node.shadowRoot) walk(node.shadowRoot)
    }
    walk(root)
    return Array.from(tags)
  }

  disconnectedCallback () {
    if (this.$rel.observer) this.$rel.observer.disconnect()
    this.removeExternalListeners()
    this.removeInternalListeners()
  }

  async attributeChangedCallback (attribute, oldValue, newValue) {
    if (!this.$rel.ignoreUpdate) {
      const prop = this.prepName(attribute)
      oldValue = this.parseAttributeValue(oldValue)
      newValue = this.parseAttributeValue(newValue)
      if (newValue !== oldValue) {
        await this.updateProps({ [prop]: newValue })
      }
    }
  }

  customQuerySelector (query, root = document) {
    let element = root.querySelector(query)
    if (element) return element
    const customElementsList = this._customElementsCollector(root)
    for (const customElement of customElementsList) {
      if (customElement.shadowRoot) {
        const result = customElement.shadowRoot.querySelector(query)
        if (result) return result
      }
    }
  }

  customQuerySelectorAll (query, root = document) {
    let elements = []
    const queriedElements = root.querySelectorAll(query)
    if (queriedElements.length > 0) {
      elements = [...elements, ...Array.from(queriedElements)]
    }
    const customElementsList = this._customElementsCollector(root)
    for (const customElement of customElementsList) {
      if (customElement.shadowRoot) {
        const result = customElement.shadowRoot.querySelectorAll(query)
        if (result.length > 0) {
          elements = [...elements, ...Array.from(result)]
        }
      }
    }
    return elements
  }

  extractInternalElements (root) {
    const ignore = ['STYLE', 'SLOT']
    let elements = []
    Array.from(root.children)
      .filter((child) => !ignore.includes(child.tagName) && !child.tagName.includes('-'))
      .forEach((child) => {
        elements.push(child)
        if (child.children.length > 0) {
          elements = [...elements, ...this.extractInternalElements(child)]
        }
      })
    return elements
  }

  parseAttributeValue (value) {
    if (value === null || value === undefined || value === '') return value
    if (typeof value === 'string') {
      if (value.indexOf('urienc') === 0) {
        value = decodeURIComponent(value.substring(6))
      }
      if ((value.trim().startsWith('{') && value.trim().endsWith('}')) || (value.trim().startsWith('[') && value.trim().endsWith(']'))) {
        try {
          value = JSON.parse(value.trim())
        } catch (e) {
          return value
        }
        if (Array.isArray(value)) {
          return value.map((el) => this.parseAttributeValue(el))
        }
        for (const [key, val] of Object.entries(value)) {
          value[key] = this.parseAttributeValue(val)
        }
        return value
      }
      if (/^\d+$/.test(value)) return parseFloat(value)
      if (value === 'false' || value === 'true') return value === 'true'
      if (value === 'undefined' || value === 'null') return null
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map((el) => this.parseAttributeValue(el))
      }
      for (const [key, val] of Object.entries(value)) {
        value[key] = this.parseAttributeValue(val)
      }
    }
    return value
  }

  prepName (attributeName) {
    if (attributeName.includes(':')) {
      const parts = attributeName.replace(':', '').split('-')
      return parts.map((part, index) => {
        if (index === 0) return part.toLowerCase()
        return part[0].toUpperCase() + part.substring(1).toLowerCase()
      }).join('')
    }
    if (attributeName.includes('@')) {
      return attributeName.replace('@', '')
    }
  }

  removeCustomAttributes () {
    this.$rel.ignoreUpdate = true
    const attrs = [...this.getAttributeNames().filter((a) => a.includes(':') || a.includes('@'))]
    attrs.forEach((attribute) => this.removeAttribute(attribute))
    this.$rel.ignoreUpdate = false
  }

  removeExternalListeners () {
    this.$rel.triggers.forEach((event) => this.removeEventListener(event, this._eventHandler))
  }

  removeInternalListeners () {
    const internalElements = this.extractInternalElements(this.$rel.dom)
    internalElements.forEach((child) => {
      const actionAttributes = Array.from(child.attributes).filter((attr) => attr.name.includes('@'))
      actionAttributes.forEach((attr) => {
        const action = attr.name.split('@')[1]
        const handler = this.$rel.methods[attr.value]
        if (handler) child.removeEventListener(action, handler)
      })
    })
  }

  setExternalListeners () {
    this.$rel.triggers.forEach((trigger) => this.addEventListener(trigger, this._eventHandler))
  }

  setInternalListeners () {
    const internalElements = this.extractInternalElements(this.$rel.dom)
    internalElements.forEach((child) => {
      const actionAttributes = Array.from(child.attributes).filter((attr) => attr.name.includes('@'))
      actionAttributes.forEach((attr) => {
        const action = attr.name.split('@')[1]
        const handler = this.$rel.methods[attr.value]
        if (handler) child.addEventListener(action, handler)
      })
    })
  }

  async updateProps (props, rerender = true) {
    props = Object.fromEntries(
      Object.entries(props).filter(([key, value]) => {
        if (this.$rel.props[key] !== undefined && this.$rel.props[key] === value) return false
        return true
      })
    )
    if (Object.keys(props).length === 0) return
    this.$rel.props = { ...this.$rel.props, ...props }
    if (this.$rel.propsUpdate) this.$rel.propsUpdate(Object.keys(props))
    if (rerender) await this.render()
  }

  renderTemplate (template) {
    const domParser = new DOMParser()
    try {
      const doc = domParser.parseFromString(template, 'text/html')
      while (this.$rel.dom.children.length > 1) {
        this.$rel.dom.children[1].remove()
      }
      for (const child of doc.body.children) {
        this.$rel.dom.appendChild(child)
      }
    } catch (error) {
      console.error('Error parsing HTML:', error)
    }
  }

  async render () {
    if (this.$rel.preRender) this.$rel.preRender()
    if (this.$rel.templateFunction) {
      this.$rel.dom.innerHTML = await this.$rel.templateFunction()
      // get link tags on document and prepend them to $rel.dom
      const linkTags = document.querySelectorAll('link[rel="stylesheet"]')
      linkTags.forEach((link) => {
        this.$rel.dom.insertBefore(link.cloneNode(true), this.$rel.dom.firstChild)
      })
    }
    const childTags = this._getCustomElementTags(this.$rel.dom)
    if (childTags.length > 0) {
      await Promise.all(childTags.map((tag) => customElements.whenDefined(tag)))
    }
    if (this.$rel.postRender) {
      this.$rel.postRender()
    }
  }
}

export function createReactiveElement (options) {
  const elementName = options.name
  const observedAttributes = (options.props || []).map((p) => `:${p}`)

  const customElement = class extends ReactiveHTMLElement {
    static observedAttributes = observedAttributes
    constructor () {
      super(options)
    }
  }
  customElements.define(elementName, customElement)
  return customElement
}

export function template (strings, ...values) {
  return async () => {
    let result = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
    if (typeof result === 'function') result = await result()
    return result
  }
}

/**
 * Wait until all custom elements in the document (including inside shadow roots) are defined.
 * Call after DOM is ready and components are registered.
 * @param {Element} [root=document.body] - Root to scan (default body)
 * @returns {Promise<void>}
 */
export function whenReady (root = document.body) {
  const tags = new Set()
  const walk = (node) => {
    if (!node) return
    if (node.tagName && node.tagName.includes('-')) {
      tags.add(node.tagName.toLowerCase())
    }
    Array.from(node.children || []).forEach(walk)
    if (node.shadowRoot) walk(node.shadowRoot)
  }
  walk(root)
  return Promise.all(Array.from(tags).map((tag) => customElements.whenDefined(tag))).then(() => {})
}

export default whenReady
