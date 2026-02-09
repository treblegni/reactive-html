# This document is meant to outline what version 2 of ReactiveHTML will offer with consideration to the version 1 implementation

# MVP
- We want to rely on the Web Component api as much as possible, without much custom implementation
- Version two should have a system for updating dynamic data properties render in the template
  - A tag function can be used to process the template literal used to render the component
    - If there are instances of expressions and the expressions are using a data property, then value should be bind to the data property used and will be replace when it is updated
- Values of expressions in the template function should be encoded automatically and the developer should not need to call encodeAttributeValue explicitly
- We want to have child components or dependent components render first if a component requires one and the parent component should wait until they are ready
  - Current Behavior:
    - All componenets are typically loaded (added to customElements) on load before and template is rendered
    - None of the components wait for any dependent components
  - Require the developer to import dependent components might be the best solution for awaiting dependencies