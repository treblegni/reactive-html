/**
 * ReactiveHTML v2 type declarations
 */

export interface ReactiveHTMLElementInstance {
  data: Record<string, unknown>
  dom: ShadowRoot
  props: Record<string, unknown>
  encodeAttributeValue: (value: unknown) => string
  parseAttributeValue: (value: unknown) => unknown
}

export interface CreateReactiveElementOptions {
  name?: string
  template: (instance: ReactiveHTMLElementInstance) => string | Promise<string>
  props?: string[]
  data?: Record<string, unknown>
  methods?: Record<string, (...args: unknown[]) => unknown>
  triggers?: string[]
  components?: Record<string, CustomElementConstructor>
  onCreate?: () => void
  preRender?: () => void
  postRender?: () => void
  propsUpdate?: (propNames: string[]) => void
}

export function createReactiveElement (
  options: CreateReactiveElementOptions
): CustomElementConstructor

export function template (
  strings: TemplateStringsArray,
  ...values: unknown[]
): () => Promise<string>

export function registerGlobalStyles (cssText: string): CSSStyleSheet
export function registerGlobalStyles (cssText: string[]): CSSStyleSheet[]

export function fetchStyleSheets (urls: string[]): Promise<CSSStyleSheet[]>

export function whenReady (root?: Element): Promise<void>

declare const whenReadyDefault: typeof whenReady
export default whenReadyDefault
