class ReactiveHTMLElement extends HTMLElement {
  $rel = {
    data: {},
    dom: null,
    events: {},
    props: {},
    triggers: [],
    ignoreUpdate: false
  }
  constructor(options) {
    super()
    this.setAttribute('rhtml-id',crypto.randomUUID())
    if (this.hasAttribute('id')) {
      this.id = this.getAttribute('id')
      this.$rel.id = this.id
    }
    this.attachShadow({mode: 'open'})
    this.$rel.dom = this.shadowRoot
    this.setLinksAndStyles()
    // props
    if (options.props && options.props.length > 0) {
      options.props.forEach(attribute => {
        const value = this.parseAttributeValue(this.getAttribute(`:${attribute}`))
        const prop = this.prepName(`:${attribute}`)
        this.$rel.props[prop] = value
      })
    }
    if (options.data && typeof options.data === 'object' && Object.keys(options.data).length > 0) {
      this.$rel.data = new Proxy(options.data,{
        set: (target, dataProp, newValue) => {
          if (dataProp in target && newValue && typeof newValue !== 'function') {
            if (typeof newValue === 'object') {
              const newObject = Object.assign({},newValue)
              const oldObject = Object.assign({},target[dataProp])
              if (JSON.stringify(oldObject) !== JSON.stringify(newObject)) {
                target[dataProp] = newObject
                this.updateDataBind(dataProp,newObject)
              }
            }
            else if (target[dataProp] !== newValue) {
              target[dataProp] = newValue
              this.updateDataBind(dataProp,newValue)
            }
          }
          return true
        },
        get: (target, dataProp) => {
          if (dataProp in target) {
            return target[dataProp]
          }
          return undefined
        }
      })
    }
    if (options.name) {
      this.$rel.name = options.name
    }
    // actions
    this.getAttributeNames().filter(attribute => attribute.includes('@'))
      .forEach(attribute => {
        if (this.hasAttribute(attribute)) {
          const handler = this.getAttribute(attribute)
          const event = this.prepName(attribute)
          const customEventFunction = (data) => { 
            this.dispatchEvent(new CustomEvent(event,{
              detail: {
                caller: this.getAttribute('rhtml-id'),
                data,
                handler,
                props: this.$rel.props
              },
              bubbles:true,
              composed:true
            }))
          }
          this.$rel.events[event] = customEventFunction
        }
      })
    // build slots object
    const slotsElements = this.querySelectorAll('[slot]')

    if (slotsElements.length > 0) {
      Array.from(slotsElements).forEach(slotsElement => {
        if (!(this.$rel.slots.includes(slotsElement.slot))) {
          this.$rel.slots.push(slotsElement.slot)
        }
      })
    }
    // listen for changes to children of root and set listeners
    this.$rel.observer = new MutationObserver((mutations) => {
      if (mutations.length > 0) {
        this.removeExternalListeners()
        this.removeInternalListeners()
        this.setExternalListeners()
        this.setInternalListeners()
        this.removeCustomAttributes()
      }
    })
    this.$rel.observer.observe(this.$rel.dom,{
      attributes: false,
      childList: true,
      subtree: true
    })
    if (!options.props || options.props.length == 0) {
      this.render()
    }
  }
  _customElementsCollector(element,collection = []) {
    const elements = Array.from(element.querySelectorAll('*')).filter(el => el.tagName.includes('-'))

    if (elements.length > 0) {
      Array.from(elements).forEach(child => {
        if (child.tagName.includes('-')) {
          collection.push(child)
          if (child.shadowRoot) {
            this._customElementsCollector(child.shadowRoot,collection)
          }
        }
      })
    }
    return collection
  }
  disconnectedCallback() {
    if (this.$rel.observer) {
      this.$rel.observer.disconnect()
    }
    this.removeExternalListeners()
    this.removeInternalListeners()
  }
  async attributeChangedCallback(attribute,oldValue,newValue) {
    if (!this.$rel.ignoreUpdate) {
      let prop = this.prepName(attribute)
      oldValue = this.parseAttributeValue(oldValue)
      newValue = this.parseAttributeValue(newValue)
      
      if (newValue != oldValue) {
        await this.updateProps({[prop]: newValue})
      }
    }
  }
  // Wrapper for querySelector that includes elements within shadowDOM
  customQuerySelector(query,root=document) {
    let element = root.querySelector(query)

    if (element) {
      return element
    }
    const customElements = this._customElementsCollector(root)

    for (const customElement of customElements) {
      if (customElement.shadowRoot) {
        const result = customElement.shadowRoot.querySelector(query)
        if (result) {
          return result
        }
      }
    }
  }
  // Wrapper for querySelectorAll that includes elements within shadowDOM
  customQuerySelectorAll(query,root=document) {
    let elements = []
    let queriedElements = root.querySelectorAll(query)
    const customElements = this._customElementsCollector(root)

    if (queriedElements.length > 0) {
      queriedElements = Array.from(queriedElements)
      elements = [...elements,...queriedElements]
    }
    for (const customElement of customElements) {
      if (customElement.shadowRoot) {
        const result = customElement.shadowRoot.querySelectorAll(query)
        if (result.length > 0) {
          elements = [...elements,...Array.from(result)]
        }
      }
    }
    return elements
  }
  emitEvent = (eventName,data) => {
    if (eventName in this.$rel.events) {
      this.$rel.events[eventName](data)
    }
    else {
      this.dispatchEvent(new CustomEvent(eventName,{
        detail: {
          caller: this.getAttribute('rhtml-id'),
          data,
          props: this.$rel.props
        },
        bubbles:true,
        composed:true
      }))
    }
  }
  eventHandler = (e) => {
    if (e.detail.caller != this.getAttribute('rhtml-id') && e.detail.handler) {
      if (e.detail.handler in this) {
        e.stopPropagation()
        this.$rel[e.detail.handler](e.detail.data,{
          ...e.detail.props,
          caller: e.detail.caller
        })
      }
    }
  }
  // Needed to pass objects via props in template literals
  encodeAttributeValue = (value) => {
    if (value) {
      if (typeof value == 'string') {
        return "urienc" + encodeURIComponent(value)
      }
      return "urienc" + encodeURIComponent(JSON.stringify(value))
    }
  }
  extractInternalElements(root,depth=0) {
    const ignore = ['STYLE','SLOT']
    let elements = []

    Array.from(root.children)
      .filter(child => !ignore.includes(child.tagName) && !child.tagName.includes('-'))
      .forEach(child => {
        elements.push(child)
        if (child.children.length > 0) {
          elements = [...elements,...this.extractInternalElements(child,depth+1)]
        }
      })
    return elements
  }
  parseAttributeValue(value) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'string') {
        // If string is a base64 encoded string: decode
        if (value.indexOf('urienc') === 0) {
          // strip the first 6 characters
          value = value.substring(6)
          value = decodeURIComponent(value)
        }
        // If a string represents a JSON object or array: JSON string
        if ((value.trim().startsWith('{') && value.trim().endsWith('}')) || (value.trim().startsWith('[') && value.trim().endsWith(']'))) {
          try {
            value = JSON.parse(value.trim())
          }
          catch (e) {
            return value
          }
          if (Array.isArray(value)) {
            return value.map((el) => {
              return this.parseAttributeValue(el)
            })
          }
          for (const [key,val] of Object.entries(value)) {
            value[key] = this.parseAttributeValue(val)
          }
          return value
        }
        // If a string represents a number
        if (/^\d+$/.test(value)) {
          return parseFloat(value)
        }
        // If a string represents a boolean
        if (value === 'false' || value === 'true') {
          return value == 'true' ? true : false
        }
        if (value === 'undefined' || value === 'null') {
          return null
        }
      }
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.map((el) => {
            return this.parseAttributeValue(el)
          })
        }
        for (const [key,val] of Object.entries(value)) {
          value[key] = this.parseAttributeValue(val)
        }
        return value
      }
      return value
    }
  }
  prepName(attributeName) {
    if (attributeName.includes(':')) {
      const parts = attributeName.replace(':','').split('-')
      return parts.map((part,index) => {
        if (index == 0) {
          return part.toLowerCase()
        }
        return part[0].toUpperCase() + part.substring(1).toLowerCase()
      }).join('')
    }
    else if (attributeName.includes('@')) {
      return attributeName.replace('@','') 
    }
  }
  extractData(path,data) {
    if (data) {
      if (path.includes('.')) {
        const dataProp = path.substring(path.indexOf('.') + 1)
        return this.extractData(dataProp,data[path.split('.')[0]])
      }
      else {
        return data[path]
      }
    }
  }
  renderTextBinding(bind,data) {
    const isContained = bind.closest('[\\:for]')
    if (!isContained) {
      const dataProp = bind.getAttribute(':text')
      const value = this.extractData(dataProp,data)
      if (value) {
        bind.innerText = value.toString()
      }
    }
  }
  renderBindings(dom) {
    const textBindings = dom.querySelectorAll('[\\:text]')

    textBindings.forEach(bind => {
      this.renderTextBinding(bind,this.$rel.data)
    })
    // loopBindings.forEach(bind => {
    //   const loopStatement = bind.getAttribute(':for')
    //   const dataProp = loopStatement.split(' in ')[1]
    //   const items = this.extractData(dataProp,this.$rel.data)
    //   if (items && Array.isArray(items)) {
    //     const bindTemplate = bind.firstElementChild
    //     bind.innerHTML = '' // Clear the bind element
    //     items.forEach(item => {
    //       const itemElement = bindTemplate.clone(true)
    //       itemElement.setAttribute('data-key',item.id || crypto.randomUUID())
    //       bind.appendChild(itemElement)
    //     })
    //   }
    // })
  }
  removeCustomAttributes() {
    this.$rel.ignoreUpdate = true
    let attributes = this.getAttributeNames().filter(attributeName => attributeName.includes(':'))
    attributes = [...attributes,...this.getAttributeNames().filter(attributeName => attributeName.includes('@'))]

    attributes.forEach(attribute => {
      this.removeAttribute(attribute)
    })
    this.$rel.ignoreUpdate = false
  }
  removeExternalListeners() {
    this.$rel.triggers.forEach(event => {
      this.removeEventListener(event,this.eventHandler)
    })
  }
  removeInternalListeners() {
    const internalElements = this.extractInternalElements(this.$rel.dom)

    internalElements.forEach(child => {
      const actionAttributes = Array.from(child.attributes).filter(attr => attr.name.includes('@'))
  
      actionAttributes.forEach(attr => {
        const action = attr.name.split('@')[1]
        child.removeEventListener(action,this.$rel[attr.value])
      })
    })
  }
  rhtml(strings, ...values) {
    // Combine strings and values
    let result = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? values[i] : '')
    }, '')
    
    // Remove line breaks and extra whitespace
    result = result.replace(/\n/g, '').replace(/\s+/g, ' ').trim()
    
    return result
  }
  setExternalListeners() {
    this.$rel.triggers.forEach(trigger => {
      this.addEventListener(trigger,this.eventHandler)
    })
  }
  setInternalListeners() {
    const internalElements = this.extractInternalElements(this.$rel.dom)

    internalElements.forEach(child => {
      const actionAttributes = Array.from(child.attributes).filter(attr => attr.name.includes('@'))
      
      actionAttributes.forEach(attr => {
        const action = attr.name.split('@')[1]
        child.addEventListener(action,this.$rel[attr.value])
      })
    })
  }
  updateDataBind(dataProp,value) {
    const bindings = this.$rel.dom.querySelectorAll(`[\\:text="${dataProp}"]`)
    bindings.forEach(bind => {
      bind.innerText = value
    })
  }
  async updateProps(props,rerender=true) {
    // Filter if value is the same
    props = Object.fromEntries(Object.entries(props).filter(([key,value]) => {
      if (this.$rel.props[key] && this.$rel.props[key] == value) {
        return false
      }
      return true
    }))
    this.$rel.props = {
      ...this.$rel.props,
      ...props
    }
    if (this.$rel.propsUpdate) {
      this.$rel.propsUpdate(Object.keys(props))
    }
    if (rerender) {
      return await this.render()
    }
  }
  setLinksAndStyles() {
    const linkTags = document.querySelectorAll('link[rel="stylesheet"]')
    const fontLinkTags = document.querySelectorAll('link[rel="preload"][as="font"]')
    const linksDiv = document.createElement('div')
    linksDiv.style.display = 'none'
    linksDiv.id = 'linked-styles'
    linksDiv.style.position = 'absolute'
    this.$rel.dom.appendChild(linksDiv)
    
    for (let link of linkTags) {
      if (link.href) { 
        linksDiv.appendChild(link.cloneNode(true))
      }
    }
    for (let link of fontLinkTags) {
      if (link.href) {
        linksDiv.appendChild(link.cloneNode(true))
      }
    }
    return linksDiv
  }
  async render() {
    if (this.$rel.preRender) {
      this.$rel.preRender()
    }
    if (this.$rel.template) {
      
      const template = await this.$rel.template()
      this.renderTemplate(template)
    }
    this.renderBindings(this.$rel.dom)
    if (this.$rel.postRender) {
      setTimeout(() => {
        this.$rel.postRender()
      },100)
    }
  }

  renderTemplate(template) {
    const domParser = new DOMParser()
    // First try to parse the renderedDOM as HTML
    try {
      const doc = domParser.parseFromString(template, 'text/html')
      
      for (let childIndex = 1 ; childIndex < this.$rel.dom.children.length ; childIndex++) {
        this.$rel.dom.children[childIndex].remove()
      }
      for (let child of doc.body.children) {
        this.$rel.dom.appendChild(child)
      }
    }
    catch (error) {
      console.error('Error parsing HTML:', error)
    }
  }
}

export const createReactiveElement = (options) => class extends ReactiveHTMLElement {
  static observedAttributes = (options.props || []).map(propName => `:${propName}`)
  constructor() {
    super({props: options.props || [],data: options.data})
    if (typeof options.triggers === 'object' && Array.isArray(options.triggers)) {
      this.$rel.triggers = options.triggers
    }
    if (typeof options.onCreate === 'function') {
      this.$rel.onCreate = options.onCreate.bind(this.$rel)
      this.$rel.onCreate()
    }
    if (typeof options.preRender === 'function') {
      this.$rel.preRender = options.preRender.bind(this.$rel)
    }
    if (typeof options.postRender === 'function') {
      this.$rel.postRender = options.postRender.bind(this.$rel)
    }
    if (typeof options.propsUpdate === 'function') {
      this.$rel.propsUpdate = options.propsUpdate.bind(this.$rel)
    }
    Object.entries(options.methods).forEach(([name, method]) => {
      if (typeof method === 'function') {
        this.$rel[name] = method.bind(this.$rel)
      }
    })
    if (typeof options.template === 'function') {
      // const templateFunction = options.template.bind(this.$rel)
      // const template = document.createElement('template')
      // template.innerHTML = templateFunction(this.$rel)
      this.$rel.template = options.template.bind(this.$rel)
    }
  }
}

export const template = (strings, ...values) => {
  return async () => {
    let result = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? values[i] : '')
    }, '')
    // If the result is a function, call it
    if (typeof result === 'function') {
      result = await result()
    }
    return result
  }
}

export default (async function() {
  const customElementsTags = (element,collection = []) => {
    const elements = Array.from(element.querySelectorAll('*')).filter(el => el.tagName.includes('-'))

    if (elements.length > 0) {
      Array.from(elements).forEach(child => {
        if (child.tagName.includes('-')) {
          if (!collection.includes(child.tagName)) {
            collection.push(child.tagName)
          }
          if (child.shadowRoot) {
            customElementsTags(child.shadowRoot,collection)
          }
        }
      })
    }
    return collection
  }
  const elements = customElementsTags(document.body)
  
  for (const tagName of elements) {
    await customElements.whenDefined(tagName.toLowerCase())
  }
  document.body.className = ''
})()