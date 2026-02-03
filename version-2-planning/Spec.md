# This document is meant to outline what version 2 of ReactiveHTML will offer with consideration to the version 1 implementation

# MVP
- Version two should have a system for updating dynamic data properties render in the template
  - Find a solution that uses the current templating function or offer one that is more practical and dev friendly with vanilla js being the target point and some syntatical sugar
  - The character ":" will be used to bind data properties
- We want to rely on the Web Component api as much as possible, without much custom implementation
- Styling Web Components with external stylsheets requires a better, more performant, solution
- We want to have child components or dependent components render first if a component requires one and the parent component should wait until they are ready
  - Current Behavior:
    - All componenets are typically loaded (added to customElements) on load before and template is rendered
    - None of the components wait for any dependent components
  - Require the developer to import dependent components might be the best solution for awaiting dependencies
- We would like to support Typescript