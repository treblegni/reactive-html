import { createReactiveElement } from 'reactive-html'

const template = function() {
  return `
    <div>
      <h2 class="cursor-pointer text-red-800 text-3xl font-semibold" @click="handleTitleClick">${this.props.title}</h2>
      <h2 :text="myTitle"></h2>
      <span :text="myObject.name"></span>
      ${this.data.items.map(item => `<span key="${item.id}">${item.name}</span>`).join('')}
      <button class="border rounded-lg h-10 px-6" @click="updateMyTitle">Change My Title</button>
    </div>
  `
}

export default createReactiveElement({
  template,
  name: 'test-component',
  props: ['title'],
  data: {
    myTitle: 'Test Example',
    myObject: {
      name: 'test',
      value: 42
    },
    items: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ]
  },
  methods: {
    test() {
      return 'test'
    },
    someOtherMethod() {
      return 'someOtherMethod'
    },
    testMe() {
      return 'testMe'
    },
    updateMyTitle() {
      this.data.myTitle = 'Create'
      this.data.myObject = {
        ...this.data.myObject,
        name: 'Some other name'
      }
    }
  }
})