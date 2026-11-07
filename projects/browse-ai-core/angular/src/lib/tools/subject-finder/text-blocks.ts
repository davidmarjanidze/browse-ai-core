export interface TextBlock {
  element: Element
  text: string
  isHeading: boolean
}

/** Elements that hold one piece of text. Text in others goes to its parent. */
const BLOCK_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'dt',
  'dd',
  'td',
  'th',
  'blockquote',
  'pre',
  'figcaption',
  'caption',
  'summary',
  'label',
  'div',
  'section',
  'article',
  'aside',
  'main',
  'header',
  'footer',
  'nav'
].join(',')
const SKIP = 'script, style, noscript, template, svg, canvas, iframe'
const HEADING = /^H[1-6]$/
const MAX_BLOCK_CHARS = 300

function isHidden(element: Element): boolean {
  // Content of a closed <details> counts: it is opened before scrolling.
  if (element.closest('details:not([open])')) return false
  const check = (
    element as Element & {
      checkVisibility?: (options?: object) => boolean
    }
  ).checkVisibility
  return check ? !check.call(element, { visibilityProperty: true }) : false
}

/**
 * Splits the page text into blocks, each tied to the element that holds it,
 * in page order. Skips hidden elements and the chat itself.
 */
export function collectTextBlocks(doc: Document, host: Element): TextBlock[] {
  const elements = new Set<Element>()
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue
    const parent = node.parentElement
    if (!parent || parent.closest(SKIP) || host.contains(parent)) continue
    elements.add(parent.closest(BLOCK_SELECTOR) ?? parent)
  }

  const blocks: TextBlock[] = []
  for (const element of elements) {
    if (isHidden(element)) continue
    const text = (element as HTMLElement).innerText ?? element.textContent ?? ''
    const clean = text.replace(/\s+/g, ' ').trim()
    const isHeading = HEADING.test(element.tagName)
    const words = clean.split(' ').length
    if (!clean || (!isHeading && words < 3)) continue
    blocks.push({ element, text: clean.slice(0, MAX_BLOCK_CHARS), isHeading })
  }
  return blocks
}
