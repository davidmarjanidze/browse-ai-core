import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, inject, signal } from '@angular/core'
import { BAC_HOST_ELEMENT } from '../../core/host-element'

export interface DomElementSelection {
  tagName: string
  elementLabel: string
  outerHtml: string
}

export interface InspectionCallbacks {
  onSelected: (selection: DomElementSelection) => void
  onCanceled?: () => void
}

/** `div#main.card.wide` style label for an element. */
export function describeElement(element: Element): string {
  const id = element.id ? `#${element.id}` : ''
  const className =
    typeof element.className === 'string' ? element.className.trim() : ''
  const classes = className
    ? `.${className.split(/\s+/u).slice(0, 2).join('.')}`
    : ''
  return `${element.tagName.toLowerCase()}${id}${classes}`
}

/** Hover-to-highlight, click-to-select picker for page elements. */
@Injectable()
export class DomInspectorService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly isInspecting = signal(false)
  readonly hoveredLabel = signal('')

  #hovered: HTMLElement | null = null
  #box: HTMLDivElement | null = null
  #label: HTMLDivElement | null = null
  #callbacks: InspectionCallbacks | null = null
  #previousCursor = ''

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop())
  }

  start(callbacks: InspectionCallbacks): void {
    this.#callbacks = callbacks
    if (this.isInspecting()) return

    const doc = this.#document
    this.#box = this.#createOverlay(
      'pointer-events:none;position:fixed;z-index:2147483646;box-sizing:border-box;display:none;border:2px solid #1a73e8;background:rgba(26,115,232,.18);'
    )
    this.#label = this.#createOverlay(
      'pointer-events:none;position:fixed;z-index:2147483647;display:none;padding:2px 6px;border-radius:4px;background:#1a73e8;color:#fff;font:600 11px ui-monospace,monospace;'
    )
    this.#previousCursor = doc.body.style.cursor
    doc.body.style.cursor = 'crosshair'

    doc.addEventListener('mousemove', this.#onMove, true)
    doc.addEventListener('scroll', this.#onScroll, true)
    doc.addEventListener('click', this.#onClick, true)
    doc.addEventListener('keydown', this.#onKey, true)
    this.isInspecting.set(true)
  }

  stop(): void {
    if (!this.isInspecting()) return
    const doc = this.#document

    doc.removeEventListener('mousemove', this.#onMove, true)
    doc.removeEventListener('scroll', this.#onScroll, true)
    doc.removeEventListener('click', this.#onClick, true)
    doc.removeEventListener('keydown', this.#onKey, true)
    doc.body.style.cursor = this.#previousCursor

    this.#box?.remove()
    this.#label?.remove()
    this.#box = this.#label = this.#hovered = this.#callbacks = null
    this.hoveredLabel.set('')
    this.isInspecting.set(false)
  }

  #createOverlay(css: string): HTMLDivElement {
    const element = this.#document.createElement('div')
    element.style.cssText = css
    this.#document.documentElement.appendChild(element)
    return element
  }

  #isPageElement(target: EventTarget | null): target is HTMLElement {
    return (
      target instanceof HTMLElement &&
      target !== this.#host &&
      !this.#host.contains(target) &&
      target !== this.#box &&
      target !== this.#label
    )
  }

  #draw(target: HTMLElement): void {
    const rect = target.getBoundingClientRect()
    if (!this.#box || !this.#label || (rect.width === 0 && rect.height === 0)) {
      this.#hide()
      return
    }
    Object.assign(this.#box.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    })
    this.#label.textContent = `${describeElement(target)}  ${Math.round(rect.width)}x${Math.round(rect.height)}`
    Object.assign(this.#label.style, {
      display: 'block',
      top: `${Math.max(4, rect.top - 24)}px`,
      left: `${Math.max(4, rect.left)}px`
    })
  }

  #hide(): void {
    if (this.#box) this.#box.style.display = 'none'
    if (this.#label) this.#label.style.display = 'none'
  }

  readonly #onMove = (event: MouseEvent): void => {
    const target = event.composedPath()[0] ?? event.target
    if (!this.#isPageElement(target)) {
      this.#hovered = null
      this.hoveredLabel.set('')
      this.#hide()
      return
    }
    this.#hovered = target
    this.hoveredLabel.set(describeElement(target))
    this.#draw(target)
  }

  readonly #onScroll = (): void => {
    if (this.#hovered) this.#draw(this.#hovered)
  }

  readonly #onClick = (event: MouseEvent): void => {
    const target = event.composedPath()[0] ?? event.target
    if (!this.#isPageElement(target)) return

    event.preventDefault()
    event.stopImmediatePropagation()
    const callbacks = this.#callbacks
    this.stop()
    callbacks?.onSelected({
      tagName: target.tagName.toLowerCase(),
      elementLabel: describeElement(target),
      outerHtml: target.outerHTML
    })
  }

  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopImmediatePropagation()
    const callbacks = this.#callbacks
    this.stop()
    callbacks?.onCanceled?.()
  }
}
