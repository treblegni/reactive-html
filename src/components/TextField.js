import { createReactiveElement } from 'reactive-html'

const template = () => `
  <input type="text" :value="value" @input="updateValue">
`

export default createReactiveElement({
  template,
  props: ['value'],
  data: {
    value: ''
  },
  name: 'text-field',
  postRender() {
    this.dom.querySelector('input').focus()
  },
  methods: {
    updateValue(e) {
      this.data.value = e.target.value
    }
  }
})