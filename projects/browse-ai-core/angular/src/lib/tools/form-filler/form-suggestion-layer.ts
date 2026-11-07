import { FormControlElement, FormFieldData } from './form-field.model'

export interface SuggestionLayerOptions {
  doc: Document
  /** Element whose `--bac-*` colors are copied, so the popups match. */
  themeSource: HTMLElement
  labels: { accept: string; dismiss: string }
  resolveElement: (fieldId: string) => FormControlElement | undefined
  onAccept: (field: FormFieldData) => void
  onDismiss: (field: FormFieldData) => void
}

const TOKENS = [
  'bg',
  'surface',
  'border',
  'text',
  'primary',
  'primary-hover',
  'on-primary',
  'accent-soft',
  'accent-text'
]

const STYLE = `
:host{all:initial}
.hl{position:fixed;pointer-events:none;border:2px solid var(--bac-primary);border-radius:4px;background:color-mix(in srgb,var(--bac-primary) 18%,transparent);z-index:2147483646}
.pop{position:fixed;z-index:2147483647;min-width:200px;max-width:min(320px,calc(100vw - 16px));box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid var(--bac-border);background:var(--bac-bg);color:var(--bac-text);font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.2)}
.val{padding:6px 8px;margin-bottom:8px;border-radius:6px;background:var(--bac-accent-soft);color:var(--bac-accent-text);font-family:ui-monospace,monospace;font-size:12px;word-break:break-word}
.row{display:flex;gap:8px}
button{flex:1;min-height:32px;border:0;border-radius:6px;font:600 12px system-ui,sans-serif;cursor:pointer}
.ok{background:var(--bac-primary);color:var(--bac-on-primary)}
.ok:hover{background:var(--bac-primary-hover)}
.no{background:var(--bac-surface);color:var(--bac-text);border:1px solid var(--bac-border)}
`

interface Entry {
  field: FormFieldData
  highlight: HTMLElement
  popup: HTMLElement
}

/**
 * Draws a highlight and an Accept / Dismiss popup next to each suggested
 * field, in a shadow root on `<body>` so page styles can't change them.
 */
export class FormSuggestionLayer {
  readonly #options: SuggestionLayerOptions
  readonly #container: HTMLElement
  readonly #root: ShadowRoot
  readonly #entries = new Map<string, Entry>()
  readonly #reposition = (): void => this.#positionAll()

  constructor(options: SuggestionLayerOptions) {
    this.#options = options
    const { doc, themeSource } = options
    this.#container = doc.createElement('div')
    this.#container.setAttribute('data-browse-ai-core-suggestions', '')
    this.#root = this.#container.attachShadow({ mode: 'open' })

    const computed = getComputedStyle(themeSource)
    const vars = TOKENS.map(
      (token) =>
        `--bac-${token}:${computed.getPropertyValue(`--bac-${token}`)};`
    ).join('')
    const style = doc.createElement('style')
    style.textContent = `:host{${vars}}${STYLE}`
    this.#root.appendChild(style)

    doc.body.appendChild(this.#container)
    doc.defaultView?.addEventListener('scroll', this.#reposition, true)
    doc.defaultView?.addEventListener('resize', this.#reposition)
  }

  get size(): number {
    return this.#entries.size
  }

  show(fields: FormFieldData[]): void {
    for (const field of fields) {
      if (!field.value?.trim() || this.#entries.has(field.id)) continue
      this.#entries.set(field.id, this.#createEntry(field))
    }
    this.#positionAll()
  }

  remove(fieldId: string): void {
    const entry = this.#entries.get(fieldId)
    if (!entry) return
    entry.highlight.remove()
    entry.popup.remove()
    this.#entries.delete(fieldId)
  }

  destroy(): void {
    const view = this.#options.doc.defaultView
    view?.removeEventListener('scroll', this.#reposition, true)
    view?.removeEventListener('resize', this.#reposition)
    this.#entries.clear()
    this.#container.remove()
  }

  #createEntry(field: FormFieldData): Entry {
    const { doc, labels } = this.#options
    const highlight = doc.createElement('div')
    highlight.className = 'hl'

    const popup = doc.createElement('div')
    popup.className = 'pop'
    popup.setAttribute('role', 'dialog')
    popup.setAttribute('aria-label', field.label || field.name)

    const value = doc.createElement('div')
    value.className = 'val'
    value.textContent = field.value ?? ''

    const row = doc.createElement('div')
    row.className = 'row'
    const accept = this.#button(labels.accept, 'ok', () => {
      this.#options.onAccept(field)
      this.remove(field.id)
    })
    const dismiss = this.#button(labels.dismiss, 'no', () => {
      this.#options.onDismiss(field)
      this.remove(field.id)
    })
    row.append(accept, dismiss)
    popup.append(value, row)
    this.#root.append(highlight, popup)
    return { field, highlight, popup }
  }

  #button(
    label: string,
    className: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = this.#options.doc.createElement('button')
    button.type = 'button'
    button.className = className
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }

  #positionAll(): void {
    const view = this.#options.doc.defaultView
    const viewportWidth = view?.innerWidth ?? 0

    for (const [fieldId, entry] of this.#entries) {
      const element = this.#options.resolveElement(fieldId)
      if (!element) continue
      const rect = element.getBoundingClientRect()

      Object.assign(entry.highlight.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      })
      const left = Math.max(8, Math.min(rect.left, viewportWidth - 216))
      Object.assign(entry.popup.style, {
        left: `${left}px`,
        top: `${rect.bottom + 8}px`
      })
    }
  }
}
