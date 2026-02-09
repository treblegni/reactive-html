# ReactiveHTML v2 — Development Plan

This plan implements the requirements in [Spec.md](./Spec.md).

---

## 1. Rely on Web Component API (minimal custom implementation)

**Spec:** Rely on the Web Component API as much as possible, without much custom implementation.

**Current state:** v2 already extends `HTMLElement`, uses `attachShadow`, `customElements.whenDefined` for child tags, and `customElements.define`. Some custom machinery remains (template parsing, `$rel`, custom attribute handling).

**Tasks:**
- **1.1 Audit** — List every non–Web-Component API (template handling, `$rel`, custom attributes). For each, decide: keep for MVP vs replace with standard APIs (`<slot>`, standard attributes, `part`/`exportparts` where useful).
- **1.2 Refactor** — Where the spec says “rely on Web Component API,” replace custom behavior with standard patterns; add only the minimum glue (e.g. one small “reactive” layer for data → DOM).
- **1.3 Document** — In code or Spec, briefly document what is “by spec” (Web Components) vs “ReactiveHTML-specific.”

**Deliverable:** Audit list + refactors so that “as much as possible” is explicit and implemented.

---

## 2. Tag-function template processing and data-bound expressions

**Spec:** A tag function processes the template literal. If expressions use a data property, bind to that property and replace the value when it is updated.

**Current state:** Template is a normal function; `templateFunction()` returns one big string; result is assigned to `innerHTML`. No tag function, no fine-grained updates—every `scheduleRender` does a full re-render.

**Tasks:**
- **2.1 Tag function API** — Define the public API: `template` as a **tagged** template literal (e.g. `html`\`...\`). Signature: `(strings, ...expressions)` with correct `this` (component instance / `$rel`).
- **2.2 Expression analysis** — For each expression, determine if it is “data-bound” (e.g. references `this.data.someProp`). Choose: static analysis of expression source or runtime convention (e.g. `data(() => this.data.myTitle)`). Document the choice.
- **2.3 Binding and updates** — For each reactive expression, record (DOM node/range, getter, optional data keys). On data change (existing Proxy), run only affected getters and update the corresponding DOM. Preserve Web Component semantics; update minimal DOM only.
- **2.4 Integration** — First render: run tag function once, inject HTML, attach bindings. Subsequent updates: no full `templateFunction()` + `innerHTML`; only update bound nodes/ranges. Keep `scheduleRender` but have it mean “run reactive updates” instead of full re-render.

**Deliverable:** Tag function that processes the template, identifies reactive expressions, and updates only those when `this.data` changes.

---

## 3. Automatic encoding; explicit encodeAttributeValue only when needed

**Spec:** Values of expressions in the template function should be encoded automatically and the developer should not need to call encodeAttributeValue explicitly.

**Current state:** `_encodeAttributeValue` exists (e.g. `urienc` + `encodeURIComponent`). Template uses raw string concatenation with no encoding. No public `encodeAttributeValue` in the template API in v2.

**Tasks:**
- **3.1 Default encoding in tag function** — For every expression result: in **text context** HTML-escape; in **attribute context** use the same scheme as `_encodeAttributeValue` (or a clear, safe scheme). Decide how context (text vs attribute) is known from template position.
- **3.2 Public encodeAttributeValue** — Expose `encodeAttributeValue(value)` on the component API so that when the developer uses it explicitly, that value is not double-encoded. Document: “Use only when you need to pass a value that is already safe/encoded or non-string.”
- **3.3 Align with parseAttributeValue** — Ensure the encoding format matches what `parseAttributeValue` expects so round-trip and existing `:attr` handling still work.

**Deliverable:** All interpolated values encoded by default; optional `encodeAttributeValue` for explicit cases; no breaking change to attribute parsing.

---

## 4. Child / dependent components render first; parent waits until ready

**Spec:** Child or dependent components render first when a component requires one; the parent waits until they are ready. Require the developer to import dependent components as the solution for awaiting dependencies.

**Current state:** All components are registered at app load; `createReactiveElement` does not use `options.components`. v2 already does `await Promise.all(childTags.map(tag => customElements.whenDefined(tag)))` before `postRender`. It does not wait for declared dependencies that might not yet be in the template.

**Tasks:**
- **4.1 Declare dependencies** — Add an option (e.g. `dependencies: [ ComponentA, ComponentB ]` or `components` with a clear contract). For each, derive the custom element tag name. Document that the developer must import and list all custom elements that may appear as children or that the parent depends on.
- **4.2 Define dependencies before first render** — In `createReactiveElement`, before defining the host (or before first `render()`): for each dependency, define if needed, then `await customElements.whenDefined(tagName)`. So when the parent’s `render()` runs, child tags are already defined; existing `whenDefined` in `render()` remains as a safety net.
- **4.3 Ordering** — Ensure that for a tree A → B → C, C is defined before B’s first render, B before A’s. Document the chosen approach (e.g. top-down define + whenDefined at registration, or parent waits for declared dependencies).
- **4.4 Optional: lazy/dynamic children** — Document that conditionally rendered children must still be in `dependencies` and imported so they are defined early, or that the parent handles “not yet defined” (e.g. optional whenDefined or fallback UI).

**Deliverable:** `dependencies` (or `components`) contract, define + await before parent render/postRender, and a short spec note on “child/dependent components render first.”

---

## 5. Implementation order and testing

Suggested order:

1. **Phase A — Encoding (Spec §3)**  
   Implement default encoding in the tag function and expose `encodeAttributeValue`. Enables safe templates before fine-grained reactivity. Test: interpolate `"<script>..."` and attribute values with `"` and `'`; assert encoded.

2. **Phase B — Tag function and bindings (Spec §2)**  
   Implement the tag function, expression detection, and minimal DOM updates. Depends on knowing “where does this expression go?” (text vs attribute). Test: change `this.data.x` and assert only the corresponding node updates.

3. **Phase C — Dependencies (Spec §4)**  
   Add `dependencies` and “define + await before parent ready.” Test: parent with `postRender` that queries a child; child in `dependencies`; assert no race.

4. **Phase D — Web Component alignment (Spec §1)**  
   Audit and refactor to use Web Component APIs as much as possible. Can be done in parallel or after B/C.

---

## 6. Open decisions to resolve in Spec or ADRs

- **Expression reactivity:** Static analysis vs runtime convention (e.g. `data(() => this.data.foo)`).
- **Encoding:** Exact rules for “attribute context” (which attributes get URI-style vs HTML encoding).
- **Dependencies:** Naming (`dependencies` vs `components`) and whether a dependency is “always define” vs “only whenDefined.”