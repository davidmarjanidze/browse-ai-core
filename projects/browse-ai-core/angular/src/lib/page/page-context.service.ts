import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, inject, signal } from '@angular/core'
import { BAC_HOST_ELEMENT, isInsideHost } from '../core/host-element'
import { PageContextInfo, extractPageContext } from './page-context.model'

const HIGHLIGHT_NAME = 'browse-ai-core-selection'
const HIGHLIGHT_STYLE_ID = 'browse-ai-core-selection-style'

/**
 * Reads the page the chat is on and remembers text the user selected on the
 * page, so it is still known after focus moves into the chat.
 */
@Injectable()
export class PageContextService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly currentContext = signal<PageContextInfo | null>(null)

  #savedRange: Range | null = null
  #savedText = ''

  constructor() {
    this.#addHighlightStyle()
    this.#document.addEventListener('selectionchange', this.#onSelectionChange)
    this.#document.addEventListener('pointerdown', this.#onPointerDown, true)

    inject(DestroyRef).onDestroy(() => {
      this.#document.removeEventListener(
        'selectionchange',
        this.#onSelectionChange
      )
      this.#document.removeEventListener(
        'pointerdown',
        this.#onPointerDown,
        true
      )
      this.#highlights()?.delete(HIGHLIGHT_NAME)
    })
  }

  extractPageContext(): PageContextInfo {
    const context = extractPageContext(this.#document, this.#savedText)
    this.currentContext.set(context)
    return context
  }

  /** Keeps the page selection visible while the chat input has focus. */
  applySelectionHighlight(): void {
    const Highlight = (
      globalThis as { Highlight?: new (range: Range) => object }
    ).Highlight
    const highlights = this.#highlights()
    if (!this.#savedRange || !Highlight || !highlights) return
    highlights.set(HIGHLIGHT_NAME, new Highlight(this.#savedRange.cloneRange()))
  }

  clearSelection(): void {
    this.#savedRange = null
    this.#savedText = ''
    this.#highlights()?.delete(HIGHLIGHT_NAME)

    const context = this.currentContext()
    if (context?.selectedText) {
      this.currentContext.set({ ...context, selectedText: '' })
    }
  }

  #highlights(): Map<string, object> | undefined {
    return (globalThis as { CSS?: { highlights?: Map<string, object> } }).CSS
      ?.highlights
  }

  readonly #onSelectionChange = (): void => {
    const selection = this.#document.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return

    const range = selection.getRangeAt(0)
    const root = range.commonAncestorContainer.getRootNode()
    if (root instanceof ShadowRoot && root.host === this.#host) return
    if (this.#host.contains(range.commonAncestorContainer)) return

    const text = selection.toString().trim()
    if (!text) return

    this.#savedRange = range.cloneRange()
    this.#savedText = text
    const context = this.currentContext()
    if (context) this.currentContext.set({ ...context, selectedText: text })
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (!isInsideHost(this.#host, event)) this.clearSelection()
  }

  #addHighlightStyle(): void {
    if (this.#document.getElementById(HIGHLIGHT_STYLE_ID)) return
    const style = this.#document.createElement('style')
    style.id = HIGHLIGHT_STYLE_ID
    style.textContent = `::highlight(${HIGHLIGHT_NAME}){background-color:#2563eb;color:#fff;}`
    this.#document.head.appendChild(style)
  }
}
