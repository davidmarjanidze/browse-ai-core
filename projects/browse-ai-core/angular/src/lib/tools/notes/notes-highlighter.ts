import { NoteRecord } from '../../core/notes-data'
import { findTextRange } from '../../page/find-text-range'
import { addHighlightStyle, highlightApi } from '../../page/reveal-element'

const NAME = 'browse-ai-core-note'

export interface HighlighterOptions {
  doc: Document
  host: HTMLElement
  openLabel: string
  onOpen: () => void
}

interface Mark {
  note: NoteRecord
  range: Range
}

/**
 * Highlights saved quotes with the CSS Custom Highlight API, so the page
 * DOM is not changed. Clicking a highlight shows the note in a popover.
 */
export class NotesHighlighter {
  readonly #options: HighlighterOptions
  #marks: Mark[] = []
  #popover: HTMLElement | null = null

  constructor(options: HighlighterOptions) {
    this.#options = options
    options.doc.addEventListener('click', this.#onClick, true)
  }

  get ranges(): Range[] {
    return this.#marks.map((mark) => mark.range)
  }

  /** Highlights every quote it can find. Returns how many were found. */
  apply(notes: NoteRecord[]): number {
    const { doc, host } = this.#options
    this.#marks = []
    for (const note of notes) {
      if (!note.quote) continue
      const range = findTextRange(
        doc,
        note.quote,
        note.before,
        note.after,
        host
      )
      if (range) this.#marks.push({ note, range })
    }
    const api = highlightApi(doc)
    if (!api) return this.#marks.length
    if (this.#marks.length === 0) {
      api.registry.delete(NAME)
      return 0
    }
    addHighlightStyle(doc, host, NAME, '--bac-accent-soft', '--bac-accent-text')
    api.registry.set(NAME, new api.Highlight(...this.ranges))
    return this.#marks.length
  }

  destroy(): void {
    this.#options.doc.removeEventListener('click', this.#onClick, true)
    highlightApi(this.#options.doc)?.registry.delete(NAME)
    this.#closePopover()
    this.#marks = []
  }

  #markAt(x: number, y: number): Mark | null {
    const doc = this.#options.doc as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    const position = doc.caretPositionFromPoint?.(x, y)
    const caret = position
      ? { node: position.offsetNode, offset: position.offset }
      : (() => {
          const range = doc.caretRangeFromPoint?.(x, y)
          return range
            ? { node: range.startContainer, offset: range.startOffset }
            : null
        })()
    if (!caret) return null
    return (
      this.#marks.find((mark) => {
        try {
          return mark.range.isPointInRange(caret.node, caret.offset)
        } catch {
          return false
        }
      }) ?? null
    )
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#popover?.contains(event.target as Node)) return
    this.#closePopover()
    if (this.#marks.length === 0) return
    const mark = this.#markAt(event.clientX, event.clientY)
    if (mark) this.#openPopover(mark, event.clientX, event.clientY)
  }

  #openPopover(mark: Mark, x: number, y: number): void {
    const { doc, host, openLabel, onOpen } = this.#options
    const theme = getComputedStyle(host)
    const token = (name: string, fallback: string) =>
      theme.getPropertyValue(name).trim() || fallback
    const popover = doc.createElement('div')
    popover.setAttribute('role', 'dialog')
    popover.setAttribute('data-browse-ai-core-note', '')
    popover.style.cssText = `position:fixed;z-index:2147483647;max-width:min(300px,calc(100vw - 16px));box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid ${token('--bac-border', '#ccc')};background:${token('--bac-bg', '#fff')};color:${token('--bac-text', '#111')};font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.2)`
    const text = doc.createElement('p')
    text.style.margin = '0 0 8px'
    text.textContent = mark.note.note || mark.note.quote
    const button = doc.createElement('button')
    button.type = 'button'
    button.textContent = openLabel
    button.style.cssText = `min-height:28px;padding:0 10px;border:0;border-radius:6px;background:${token('--bac-primary', '#2563eb')};color:${token('--bac-on-primary', '#fff')};font:600 12px system-ui,sans-serif;cursor:pointer`
    button.addEventListener('click', () => {
      this.#closePopover()
      onOpen()
    })
    popover.append(text, button)
    const width = doc.defaultView?.innerWidth ?? 800
    popover.style.left = `${Math.max(8, Math.min(x, width - 308))}px`
    popover.style.top = `${y + 12}px`
    doc.body.appendChild(popover)
    this.#popover = popover
  }

  #closePopover(): void {
    this.#popover?.remove()
    this.#popover = null
  }
}
