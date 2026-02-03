# reactive-html-v2

ReactiveHTML v2: Web Components with reactive data, Constructable Stylesheets, and dependency-aware readiness. See [version-2-planning/Plan-v2-Opus.md](../../version-2-planning/Plan-v2-Opus.md) for the full plan.

## Differences from v1

- **Auto-render on data change** — Updating `this.data` schedules a single re-render (batched via microtask). Template interpolations like `${data.x}` update automatically.
- **Constructable Stylesheets** — Use `registerGlobalStyles(cssText)` or `fetchStyleSheets(urls)` before defining components; styles are shared via `adoptedStyleSheets` (no link cloning).
- **Parent waits for children** — After render, the component waits for child custom elements to be defined before running `postRender`.
- **whenReady()** — Export `whenReady(root?)` walks the DOM (and shadow roots), awaits `customElements.whenDefined` for each tag, then resolves. Use as app bootstrap.
- **Slots fix** — `$rel.slots` is initialized; no runtime error when using slots.

## Usage

```javascript
import { createReactiveElement, registerGlobalStyles, whenReady } from 'reactive-html-v2'

// Optional: register global styles (call before defining components)
registerGlobalStyles(`
  :host { display: block; }
  button { padding: 0.5rem 1rem; }
`)

const MyComponent = createReactiveElement({
  name: 'my-component',
  props: ['title'],
  data: { count: 0 },
  template ({ props, data }) {
    return `
      <h1>${props.title}</h1>
      <span>${data.count}</span>
      <button @click="increment">Increment</button>
    `
  },
  methods: {
    increment () {
      this.data.count++
      // Template re-renders automatically (batched)
    }
  }
})

customElements.define('my-component', MyComponent)

// Bootstrap: wait for all custom elements to be defined
await whenReady()
```

## TypeScript

The package includes `index.d.ts`. Use from TypeScript with typed options and template context.
