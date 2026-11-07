const REVEAL_NAME = 'browse-ai-core-reveal'
const STYLE_ID = 'browse-ai-core-reveal-style'

type HighlightRegistry = Map<string, unknown>
type HighlightConstructor = new (...ranges: Range[]) => object

const timers = new WeakMap<Document, ReturnType<typeof setTimeout>>()

/** `CSS.highlights` and `Highlight`, or null when the browser has no support. */
export function highlightApi(
  doc: Document
): { registry: HighlightRegistry; Highlight: HighlightConstructor } | null {
  const view = doc.defaultView as
    (Window & { CSS?: { highlights?: HighlightRegistry } }) | null
  const registry = view?.CSS?.highlights
  const Highlight = (globalThis as { Highlight?: HighlightConstructor })
    .Highlight
  return registry && Highlight ? { registry, Highlight } : null
}

/**
 * Adds a `::highlight(name)` rule to the page. Page CSS can't see the chat's
 * variables, so the colors are copied from the chat host.
 */
export function addHighlightStyle(
  doc: Document,
  host: HTMLElement,
  name: string,
  background: string,
  color: string
): void {
  const id = `${STYLE_ID}-${name}`
  let style = doc.getElementById(id)
  if (!style) {
    style = doc.createElement('style')
    style.id = id
    doc.head.appendChild(style)
  }
  const theme = getComputedStyle(host)
  const value = (token: string, fallback: string) =>
    theme.getPropertyValue(token).trim() || fallback
  style.textContent = `::highlight(${name}){background-color:${value(background, '#2563eb')};color:${value(color, '#fff')};}`
}

/** Opens closed `<details>` around the element so it can be seen. */
function openDetails(element: Element): void {
  for (
    let details = element.closest('details:not([open])');
    details;
    details = details.parentElement?.closest('details:not([open])') ?? null
  ) {
    ;(details as HTMLDetailsElement).open = true
  }
}

/**
 * Scrolls an element or text range into view and highlights it for `ms`
 * milliseconds.
 */
export function revealOnPage(
  doc: Document,
  host: HTMLElement,
  target: Element | Range,
  ms = 3000
): void {
  const element =
    target instanceof Range
      ? target.startContainer.parentElement
      : (target as Element)
  if (!element) return
  openDetails(element)
  element.scrollIntoView?.({ behavior: 'smooth', block: 'center' })

  const api = highlightApi(doc)
  if (!api) return
  addHighlightStyle(doc, host, REVEAL_NAME, '--bac-primary', '--bac-on-primary')
  let range: Range
  if (target instanceof Range) {
    range = target
  } else {
    range = doc.createRange()
    range.selectNodeContents(target)
  }
  api.registry.set(REVEAL_NAME, new api.Highlight(range))
  clearTimeout(timers.get(doc))
  timers.set(
    doc,
    setTimeout(() => api.registry.delete(REVEAL_NAME), ms)
  )
}
