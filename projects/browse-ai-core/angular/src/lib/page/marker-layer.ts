export interface PageMarker {
  id: string
  element: Element
  /** Short text on the badge, for example a number. */
  badge: string
  title: string
  text: string
  /** Optional button in the popover. */
  action?: { label: string; run: () => void }
}

export interface MarkerLayerOptions {
  doc: Document
  /** Element whose `--bac-*` colors are copied, so the markers match. */
  themeSource: HTMLElement
}

const TOKENS = [
  'bg',
  'surface',
  'border',
  'text',
  'warning',
  'warning-soft',
  'primary',
  'on-primary'
]

const STYLE = `
:host{all:initial}
.box{position:fixed;pointer-events:none;border:2px solid var(--bac-warning);border-radius:4px;z-index:2147483645}
.badge{position:fixed;z-index:2147483646;min-width:20px;height:20px;padding:0 6px;border:0;border-radius:10px;background:var(--bac-warning);color:var(--bac-bg);font:700 11px/20px system-ui,sans-serif;cursor:pointer}
.badge:focus-visible{outline:2px solid var(--bac-primary);outline-offset:2px}
.pop{position:fixed;z-index:2147483647;display:none;max-width:min(300px,calc(100vw - 16px));box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--bac-border);background:var(--bac-bg);color:var(--bac-text);font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.2)}
.pop.open{display:block}
.pop b{display:block;margin-bottom:4px}
.pop button{margin-top:8px;min-height:28px;padding:0 10px;border:0;border-radius:6px;background:var(--bac-primary);color:var(--bac-on-primary);font:600 12px system-ui,sans-serif;cursor:pointer}
`

interface Entry {
  marker: PageMarker
  box: HTMLElement
  badge: HTMLButtonElement
  popover: HTMLElement
}

/**
 * Draws an outline and a numbered badge next to page elements. Clicking,
 * hovering or focusing a badge shows its text. Lives in a shadow root on
 * `<body>`, so page styles can't change it.
 */
export class MarkerLayer {
  readonly #doc: Document
  readonly #container: HTMLElement
  readonly #root: ShadowRoot
  readonly #entries = new Map<string, Entry>()
  readonly #reposition = (): void => this.#positionAll()

  constructor({ doc, themeSource }: MarkerLayerOptions) {
    this.#doc = doc
    this.#container = doc.createElement('div')
    this.#container.setAttribute('data-browse-ai-core-markers', '')
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

  has(id: string): boolean {
    return this.#entries.has(id)
  }

  show(markers: PageMarker[]): void {
    for (const marker of markers) {
      this.remove(marker.id)
      this.#entries.set(marker.id, this.#create(marker))
    }
    this.#positionAll()
  }

  remove(id: string): void {
    const entry = this.#entries.get(id)
    if (!entry) return
    entry.box.remove()
    entry.badge.remove()
    entry.popover.remove()
    this.#entries.delete(id)
  }

  destroy(): void {
    const view = this.#doc.defaultView
    view?.removeEventListener('scroll', this.#reposition, true)
    view?.removeEventListener('resize', this.#reposition)
    this.#entries.clear()
    this.#container.remove()
  }

  #create(marker: PageMarker): Entry {
    const doc = this.#doc
    const box = doc.createElement('div')
    box.className = 'box'

    const popover = doc.createElement('div')
    popover.className = 'pop'
    popover.setAttribute('role', 'tooltip')
    popover.id = `bac-marker-${marker.id}`
    const title = doc.createElement('b')
    title.textContent = marker.title
    const text = doc.createElement('span')
    text.textContent = marker.text
    popover.append(title, text)
    if (marker.action) {
      const action = doc.createElement('button')
      action.type = 'button'
      action.textContent = marker.action.label
      action.addEventListener('click', marker.action.run)
      popover.append(doc.createElement('br'), action)
    }

    const badge = doc.createElement('button')
    badge.type = 'button'
    badge.className = 'badge'
    badge.textContent = marker.badge
    badge.setAttribute('aria-label', `${marker.badge}: ${marker.title}`)
    badge.setAttribute('aria-describedby', popover.id)
    const open = () => popover.classList.add('open')
    const close = () => popover.classList.remove('open')
    badge.addEventListener('mouseenter', open)
    badge.addEventListener('focus', open)
    badge.addEventListener('blur', close)
    badge.addEventListener('mouseleave', close)
    badge.addEventListener('click', () => popover.classList.toggle('open'))
    popover.addEventListener('mouseenter', open)
    popover.addEventListener('mouseleave', close)

    this.#root.append(box, badge, popover)
    return { marker, box, badge, popover }
  }

  #positionAll(): void {
    const width = this.#doc.defaultView?.innerWidth ?? 0
    for (const entry of this.#entries.values()) {
      const element = entry.marker.element
      if (!element.isConnected) continue
      const rect = element.getBoundingClientRect()
      Object.assign(entry.box.style, {
        left: `${rect.left - 2}px`,
        top: `${rect.top - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`
      })
      const badgeLeft = Math.max(4, Math.min(rect.right - 10, width - 30))
      const badgeTop = Math.max(4, rect.top - 10)
      Object.assign(entry.badge.style, {
        left: `${badgeLeft}px`,
        top: `${badgeTop}px`
      })
      Object.assign(entry.popover.style, {
        left: `${Math.max(8, Math.min(rect.left, width - 308))}px`,
        top: `${rect.bottom + 8}px`
      })
    }
  }
}
