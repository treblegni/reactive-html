# ReactiveHTMLElement v2.0

### **Overview:**

ReactiveHTMLElement class extends the standard HTMLElement class that is used to create JS Web Components. Its main purpose is to introduce reactivity and flow of data to Web Components by introducing a minimal framework that relies heavily on standard JS and a dash of syntactical sugar.

### **Example:**

```javascript
import { createReactiveElement } from 'reactive-html'

const template = ({props}) => {
  return `
    <div>My name is: ${props.name}</div>
    <input value="${props.name}">
    <button @click="updateName">Update Name</button>
  `
}

export default createReactiveElement({
	name: 'reactive-web-component',
	template,
	props: 'name',
	methods: {
    updateName(e) {
      const input = this.dom.querySelector('input')
      const value = input.value
      this.setAttribute(':name',value)
    }
  }
)
```

## **The Template Function**

The template function is used to both define and render the template of the component. In ReactiveHTML, you return a template literal that will be used to render the component, offering JSX-like syntax.

Within the function, you can perform normal JS and have access to the props, data, and methods by destructuring the instance parameter

```javascript
import { createReactiveElement } from 'reactive-html'

const template = ({props,data,...}) {
  const name = 'Template'
  return `
    <div>
      I'm a ${name}
    </div>
  `
}

export default createReactiveElement({
	name: 'my-component',
	template,
	...
)
```

## **The Render Function**

If you want changes to the state to reflect on the component, then you need to call the render function without parameters.:

```javascript
// Can be called anywhere after component is created
this.render()
```

## **Props**

Props are a fundamental way of passing data from parent to child components. Props are assigned by adding a bound attribute. Bound attributes are prefixed with a `:` and are one-way (parent → child). The code below shows an example of the prop `:description`:

```javascript
import { createReactiveHTML } from 'reactive-html'
import MyDescription from 'my-description'

const template = () => {
  const name = 'Template'
  const description = "I'm used to create components"
  return `
    <div>
      I'm a ${name}
      <my-description :description="${description}">
      </my-description>
    </div>
  `
}

export default createReactiveElement({
	name: 'my-component',
	components: {
		MyDescription
	},
	template
)
```

Props can be accessed from any component that extends ReactiveHTMLElement via `this.props` instance property within methods or with the destructured variable `props` within the template function. The `my-description` component below illustrates how `:description` can be accessed:

```javascript
import { createReactiveHTML } from 'reactive-html'

const template = ({props}) => {
  return `
    <div>
      ${props.description}
    </div>
  `
}

export default createReactiveElement({
	name: 'my-description',
	template,
	props: {
		description: String
	}
)
```

### **Encoding non-primitive values**

Primitives can be set to props without encoding, but non-primitives must be encoded. To encode a prop value. Thankfully, the bind syntax will encode the value

```javascript
import { createReactiveHTML } from 'reactive-html'
import UserProfile from 'user-profile'

const template = ({encodeAttributeValue}) => {
  const user = encodeAttributeValue({
    firstName: "John",
    lastName: "Doe",
    dob: "09/19/1999"
  })
  return `
    <div>
      <user-profile :user="${user}">
      </user-profile>
    </div>
  `)
}

export default createReactiveElement(
	name: 'my-component',
	components: {
		UserProfile
	},
	template
)
```

## **Reactivity**

### **Prop updates**

Components can react to prop changes, which will initiate a re-render. Any children will also be updated in the process

If you need to do something during the update or need to assign the same value to a data prop then you can do so via the `propUpdate()`  lifecycle which occurs before render:

```javascript
const template = function(instance) {
  return `
    <div>
      I'm a template
    </div>
  `
}
customElements.define('my-component',
  class MyComponent extends ReactiveHTMLElement {
    static observedAttributes = [":name"]
    constructor() {
      super()
      this.render(template)
    }
// Fired before render
    propUpdate(propName,value) {
      console.log(propName,value)
    }
  }
)
```

Note: For changes to props to be observed, you must declare the observed props by defining the static variable `observedAttributes`:

```javascript
customElements.define('my-component',
  class MyComponent extends ReactiveHTMLElement {
    static observedAttributes = [":name"]
//...
  }
)
```

### **Emitting Events**

If you want/need to broadcast changes to the component's state, `this.emitEvent()` can be used from anywhere within. Any parent component can catch the emitted event. The event will not continue propagating after it is caught.

`emitEvent()` can take two parameters:

- name: The name of the event that will be triggered
- value (optional): Can be any value

```javascript
//...
this.emitEvent("update")
//...
```

### **Action (@) attributes**

`this.emitEvent()`relies on action attributes that are defined on the component's custom tag. Events will not be emitted unless these are defined and the handler names must be specified as the value of the attribute. Action attributes can be any name and are prefixed with @:

```javascript
const template = function(instance) {
  const name = "Child"
  return `
    <div>
      <child-component
        :name="${name}"
        @update="handleUpdate">
      </child-component>
    </div>
  `
}
customElements.define('parent-component',
  class ParentComponent extends ReactiveHTMLElement {
    triggers = [
      "update"
    ]
    constructor() {
      super()
      this.render(template)
    }
    handleUpdate = (update) => {
      console.log(update)
    }
  }
)
```

Note: The value of the update action attribute is "handleUpdate" which is the name of the component method `handleUpdate()`.

The handler has access to two parameters

- value: The value that was passed from the child
- context: The properties of the calling component

### **Internal Action Attributes**

Action attributes can also be used on HTML tags within the template, but only supported HTML events will function. Handlers will have an event as the parameter:

```javascript
const template = function(instance) {
  return `
    <div>
      <button @click="handleClick">
        Click me!
      </button>
    </div>
  `
}
customElements.define('child-component',
  class ChildComponent extends ReactiveHTMLElement {
    constructor() {
      super()
      this.render(template)
    }
    handleClick = (event) => {
      console.log(event)
    }
  }
)
```

Note: Internal action events do not need to be declared.

## **ReactiveHTMLElement Lifecycles**

### **propsUpdate**

The propsUpdate lifecycle will fire in the pre-render phase when a prop is updated. An array of prop names will be available as the first parameter

### **postRender**

The postRender will fire when the render method is called and only after DOM has been resolved

## **Access to Web Component DOM**

You can access the current web component with `this.dom`. The normal Element API should then be available when manipulating DOM

```javascript
const template = function(instance) {
  return `
    <div>
      <button @click="handleClick">
        Click me!
      </button>
    </div>
  `
}
customElements.define('my-component',
  class MyComponent extends ReactiveHTMLElement {
    constructor() {
      super()
      this.render(template)
    }
    connectedCallback() {
      const button = this.dom.querySelector('button')
      console.log(button)// prints element in console when web component is mounted
    }
  }
)
```

## **Slots**

Content that's externally added to the Web Component can be rendered with slot tags. If named, then the slot must have the name of the corresponding content:

```html
<!DOCTYPE html>
<html language="en">
<head>
</head>
<body>
  <my-component>
    <div slot="slot-one">
      Render me!
    </div>
  </my-component>
</body>
</html>
```

```javascript
const template = function(instance) {
  return `
    <div>
      <h1>My Component</h1>
      <slot name="slot-one"></slot>
    </div>
  `
}
customElements.define('my-component',
  class MyComponent extends ReactiveHTMLElement {
    constructor() {
      super()
      this.render(template)
    }
  }
)
```

Additional