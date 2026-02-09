import { createReactiveElement } from 'reactive-html'

function template() {
  return `
    <input type="text" value="${this.props.value}" @input="updateValue">
  `
}

export default createReactiveElement({
  template,
  props: ['value'],
  name: 'text-field',
  postRender() {
    this.dom.querySelector('input').focus()
  },
  methods: {
    updateValue(e) {
      this.emitEvent('change', e.target.value)
    }
  }
})