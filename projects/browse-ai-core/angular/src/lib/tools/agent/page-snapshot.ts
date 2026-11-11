import { isSensitiveField } from '../../page/insert-text'

/** Most elements listed in one observation. */
export const MAX_ELEMENTS = 150
/** Character budget of the element list. */
export const MAX_SNAPSHOT_CHARS = 9_000

const INTERACTIVE = [
  'a[href]',
  'button',
  'input:not([type=hidden])',
  'select',
  'textarea',
  'summary',
  '[role=button]',
  '[role=link]',
  '[role=checkbox]',
  '[role=radio]',
  '[role=tab]',
  '[role=menuitem]',
  '[role=option]',
  '[role=switch]',
  '[role=combobox]',
  '[role=textbox]',
  '[contenteditable=""]',
  '[contenteditable=true]',
  '[tabindex]:not([tabindex="-1"])',
  '[onclick]'
].join(',')

export interface PageSnapshot {
  url: string
  title: string
  scrollY: number
  scrollHeight: number
  viewport: { width: number; height: number }
  /** One `[ref] role "name" …` line per element. */
  lines: string[]
  /** Elements that did not fit the budget. */
  omitted: number
}

/**
 * Numbers handed to the model, mapped to elements. Never stored on the page.
 * An element keeps its number for the whole run.
 */
export class RefMap {
  readonly #elements = new Map<number, Element>()
  readonly #refs = new WeakMap<Element, number>()
  #next = 1

  add(element: Element): number {
    const known = this.#refs.get(element)
    if (known !== undefined) return known
    const ref = this.#next++
    this.#elements.set(ref, element)
    this.#refs.set(element, ref)
    return ref
  }

  get(ref: number): Element | null {
    const element = this.#elements.get(ref)
    return element?.isConnected ? element : null
  }

  entries(): [number, Element][] {
    return [...this.#elements].filter(([, element]) => element.isConnected)
  }

  /** Forgets elements that left the page. */
  prune(): void {
    for (const [ref, element] of this.#elements)
      if (!element.isConnected) this.#elements.delete(ref)
  }
}

const clean = (text: string | null | undefined, max = 80): string =>
  (text ?? '').replace(/\s+/gu, ' ').trim().slice(0, max)

/** Every element in the document, open shadow roots and same-origin frames. */
export function* walkElements(root: Document | ShadowRoot): Generator<Element> {
  const all = root.querySelectorAll('*')
  for (const element of all) {
    yield element
    if (element.shadowRoot) yield* walkElements(element.shadowRoot)
    if (element instanceof HTMLIFrameElement) {
      let inner: Document | null = null
      try {
        inner = element.contentDocument
      } catch {
        inner = null
      }
      if (inner) yield* walkElements(inner)
    }
  }
}

export function roleOf(element: Element): string {
  const role = element.getAttribute('role')
  if (role) return role
  const tag = element.tagName.toLowerCase()
  if (tag === 'a') return 'link'
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') return type
    if (type === 'submit' || type === 'button' || type === 'reset')
      return 'button'
    return `input:${type}`
  }
  if (tag === 'select') return 'select'
  if (tag === 'textarea') return 'textarea'
  if ((element as HTMLElement).isContentEditable) return 'textbox'
  return tag
}

/** Accessible name in a simple form: aria-label, labels, text, alt, title. */
export function nameOf(element: Element): string {
  const doc = element.ownerDocument
  const labelledBy = element.getAttribute('aria-labelledby')
  const byIds = labelledBy
    ?.split(/\s+/u)
    .map((id) => doc.getElementById(id)?.textContent ?? '')
    .join(' ')
  const id = element.getAttribute('id')
  const label =
    (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
    element.closest('label')
  const field =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  return clean(
    element.getAttribute('aria-label') ||
      byIds ||
      (field ? label?.textContent : '') ||
      (!field
        ? (element as HTMLElement).innerText || element.textContent
        : '') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('alt') ||
      element.querySelector('img[alt]')?.getAttribute('alt') ||
      element.getAttribute('title') ||
      element.getAttribute('name') ||
      element.getAttribute('value')
  )
}

function stateOf(element: Element): string {
  const parts: string[] = []
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio')
      parts.push(element.checked ? 'checked' : 'unchecked')
    else if (!isSensitiveField(element) && element.value)
      parts.push(`value="${clean(element.value, 60)}"`)
  }
  if (element instanceof HTMLTextAreaElement && element.value)
    parts.push(`value="${clean(element.value, 60)}"`)
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0]
    if (selected) parts.push(`value="${clean(selected.textContent, 40)}"`)
    const options = [...element.options].map((option) =>
      clean(option.textContent, 20)
    )
    parts.push(
      `options=${options.slice(0, 12).join('|')}${options.length > 12 ? '|…' : ''}`
    )
  }
  for (const attribute of ['aria-checked', 'aria-expanded', 'aria-selected']) {
    const value = element.getAttribute(attribute)
    if (value) parts.push(`${attribute.slice(5)}=${value}`)
  }
  if (
    (element as HTMLButtonElement).disabled ||
    element.getAttribute('aria-disabled') === 'true'
  )
    parts.push('disabled')
  if (element.ownerDocument.activeElement === element) parts.push('focused')
  return parts.join(' ')
}

/** Shown, non-empty, and near the viewport (one screen above or below). */
export function isShown(element: Element, viewportHeight: number): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  if (rect.bottom < -viewportHeight || rect.top > viewportHeight * 2)
    return false
  const view = element.ownerDocument.defaultView
  const style = view?.getComputedStyle(element)
  return !(
    style?.display === 'none' ||
    style?.visibility === 'hidden' ||
    style?.opacity === '0'
  )
}

/** True when another page element covers the element's center. */
function isCovered(element: Element, viewportHeight: number): boolean {
  const doc = element.ownerDocument
  const rect = element.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  if (y < 0 || y > viewportHeight || typeof doc.elementFromPoint !== 'function')
    return false
  const top = doc.elementFromPoint(x, y)
  if (!top) return false
  return !(
    top === element ||
    element.contains(top) ||
    top.contains(element) ||
    (top instanceof HTMLLabelElement && top.control === element)
  )
}

/** The chat element itself, and fields that must never be touched. */
export function isOffLimits(element: Element, host: Element | null): boolean {
  if (host && (element === host || host.contains(element))) return true
  if (host?.shadowRoot && host.shadowRoot.contains(element)) return true
  return isSensitiveField(element)
}

/** One line per element, as the model sees it. */
export function describeForModel(ref: number, element: Element): string {
  const rect = element.getBoundingClientRect()
  const state = stateOf(element)
  const href =
    element instanceof HTMLAnchorElement && element.getAttribute('href')
      ? ` href=${clean(element.getAttribute('href'), 60)}`
      : ''
  return `[${ref}] ${roleOf(element)} "${nameOf(element)}"${state ? ` ${state}` : ''}${href} @${Math.round(rect.left)},${Math.round(rect.top)}`
}

/**
 * Lists visible interactive elements with numbers. Elements in view come
 * first, then those closest to it, within the size budget.
 */
export function takeSnapshot(
  doc: Document,
  host: Element | null,
  refs: RefMap
): PageSnapshot {
  const view = doc.defaultView
  const height = view?.innerHeight ?? 800
  refs.prune()

  const found: Element[] = []
  for (const element of walkElements(doc)) {
    if (!element.matches(INTERACTIVE)) continue
    if (isOffLimits(element, host)) continue
    if (!isShown(element, height) || isCovered(element, height)) continue
    found.push(element)
  }
  const distance = (element: Element): number => {
    const rect = element.getBoundingClientRect()
    if (rect.bottom >= 0 && rect.top <= height) return 0
    return rect.top < 0 ? -rect.bottom : rect.top - height
  }
  const ordered = found
    .map((element, index) => ({ element, index, distance: distance(element) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)

  const lines: string[] = []
  let size = 0
  for (const { element } of ordered) {
    if (lines.length >= MAX_ELEMENTS) break
    const line = describeForModel(refs.add(element), element)
    if (size + line.length > MAX_SNAPSHOT_CHARS) break
    lines.push(line)
    size += line.length + 1
  }

  return {
    url: doc.location?.href ?? '',
    title: clean(doc.title, 120),
    scrollY: Math.round(view?.scrollY ?? 0),
    scrollHeight: doc.documentElement.scrollHeight,
    viewport: { width: view?.innerWidth ?? 0, height },
    lines,
    omitted: ordered.length - lines.length
  }
}

/** The snapshot as prompt text. */
export function formatSnapshot(snapshot: PageSnapshot): string {
  return [
    `URL: ${snapshot.url}`,
    `TITLE: ${snapshot.title}`,
    `SCROLL: ${snapshot.scrollY} of ${snapshot.scrollHeight}, viewport ${snapshot.viewport.width}x${snapshot.viewport.height}`,
    'ELEMENTS (ref role "name" state @x,y):',
    ...(snapshot.lines.length ? snapshot.lines : ['(none visible)']),
    ...(snapshot.omitted
      ? [`(${snapshot.omitted} more not listed; scroll or use find_text)`]
      : [])
  ].join('\n')
}
