import { PageSnapshot, RefMap, takeSnapshot } from './page-snapshot'

/** Events that can change what is shown without a DOM record. */
const EVENTS = [
  'scroll',
  'input',
  'change',
  'focusin',
  'focusout',
  'transitionend',
  'animationend',
  'load'
]

/** Page parts added by the chat itself. Changes in them are not page changes. */
const OWN_PARTS = '[data-browse-ai-core-markers],[data-browse-ai-core-flash]'

/**
 * Keeps the last snapshot while the page does not change, so an observation
 * after a step that only read the page does not walk the DOM again. Any DOM
 * change, scroll, resize, input or focus change marks it stale.
 */
export class PageObserver {
  readonly #doc: Document
  readonly #host: HTMLElement | null
  readonly #refs: RefMap
  #observer: MutationObserver | null = null
  #last: PageSnapshot | null = null
  #dirty = true

  readonly #markDirty = (): void => {
    this.#dirty = true
  }

  constructor(doc: Document, host: HTMLElement | null, refs: RefMap) {
    this.#doc = doc
    this.#host = host
    this.#refs = refs
  }

  start(): void {
    const view = this.#doc.defaultView
    if (view?.MutationObserver) {
      this.#observer = new view.MutationObserver((records) => {
        if (records.some((record) => !this.#isOwn(record))) this.#dirty = true
      })
      this.#observer.observe(this.#doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      })
    }
    for (const type of EVENTS)
      this.#doc.addEventListener(type, this.#markDirty, true)
    view?.addEventListener('resize', this.#markDirty)
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
    for (const type of EVENTS)
      this.#doc.removeEventListener(type, this.#markDirty, true)
    this.#doc.defaultView?.removeEventListener('resize', this.#markDirty)
    this.#last = null
    this.#dirty = true
  }

  /** Forces the next snapshot to be taken again. */
  invalidate(): void {
    this.#dirty = true
  }

  /** The current snapshot; the last one when nothing changed since. */
  snapshot(): PageSnapshot {
    this.#observer?.takeRecords().forEach((record) => {
      if (!this.#isOwn(record)) this.#dirty = true
    })
    if (this.#dirty || !this.#last || this.#lostElement()) {
      this.#last = takeSnapshot(this.#doc, this.#host, this.#refs)
      this.#dirty = false
    }
    return this.#last
  }

  #lostElement(): boolean {
    return (
      this.#last?.items.some((item) => this.#refs.get(item.ref) === null) ??
      false
    )
  }

  #isOwn(record: MutationRecord): boolean {
    const nodes = (
      record.type === 'childList'
        ? [...record.addedNodes, ...record.removedNodes]
        : [record.target]
    )
      .map((node) => (node instanceof Element ? node : node.parentElement))
      .filter((node): node is Element => node !== null)
    if (!nodes.length) return false
    return nodes.every(
      (node) =>
        node.closest(OWN_PARTS) !== null ||
        (this.#host !== null &&
          (node === this.#host || this.#host.contains(node)))
    )
  }
}
