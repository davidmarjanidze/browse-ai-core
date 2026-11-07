import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import { ConfigStore } from '../core/config.store'
import { BAC_HOST_ELEMENT } from '../core/host-element'
import { StorageService } from '../core/storage.service'

export interface PageSelection {
  text: string
  /** Selection box in viewport coordinates. */
  rect: { top: number; bottom: number; left: number; right: number }
}

const EDITABLE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

/** Watches text selections on the page for the selection actions bar. */
@Injectable()
export class SelectionActionsService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #storage = inject(StorageService)
  readonly #features = inject(ConfigStore).features

  /** User setting, on by default. */
  readonly enabled = signal(true)
  readonly selection = signal<PageSelection | null>(null)
  readonly isActive = computed(
    () => this.#features().selectionActions && this.enabled()
  )

  constructor() {
    const doc = this.#document
    doc.addEventListener('mouseup', this.#onSelectionEnd)
    doc.addEventListener('keyup', this.#onSelectionEnd)
    doc.addEventListener('keydown', this.#onKeydown)
    doc.addEventListener('selectionchange', this.#onSelectionChange)
    doc.addEventListener('scroll', this.hide, true)
    doc.defaultView?.addEventListener('resize', this.hide)

    inject(DestroyRef).onDestroy(() => {
      doc.removeEventListener('mouseup', this.#onSelectionEnd)
      doc.removeEventListener('keyup', this.#onSelectionEnd)
      doc.removeEventListener('keydown', this.#onKeydown)
      doc.removeEventListener('selectionchange', this.#onSelectionChange)
      doc.removeEventListener('scroll', this.hide, true)
      doc.defaultView?.removeEventListener('resize', this.hide)
    })

    void this.#storage
      .loadPreferences()
      .then((preferences) => this.enabled.set(preferences.selectionActions))
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled)
    if (!enabled) this.hide()
    void this.#storage.setPreferences({ selectionActions: enabled })
  }

  readonly hide = (): void => this.selection.set(null)

  /** Reads the current page selection. Null inside the chat or fields. */
  read(): PageSelection | null {
    const selection = this.#document.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return null
    const text = selection.toString().trim()
    if (!text) return null

    const range = selection.getRangeAt(0)
    const node = range.commonAncestorContainer
    const root = node.getRootNode()
    if (root instanceof ShadowRoot && root.host === this.#host) return null
    if (this.#host.contains(node)) return null
    const element = node instanceof Element ? node : node.parentElement
    if (element?.closest(EDITABLE)) return null
    if (this.#document.activeElement?.matches(EDITABLE)) return null

    const box =
      range.getBoundingClientRect?.() ?? element?.getBoundingClientRect()
    const { top = 0, bottom = 0, left = 0, right = 0 } = box ?? {}
    return { text, rect: { top, bottom, left, right } }
  }

  readonly #onSelectionEnd = (event: Event): void => {
    if (!this.isActive()) return
    if (event.composedPath().includes(this.#host)) return
    this.selection.set(this.read())
  }

  readonly #onSelectionChange = (): void => {
    if (this.selection() && !this.#document.getSelection()?.toString().trim())
      this.hide()
  }

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide()
  }
}
