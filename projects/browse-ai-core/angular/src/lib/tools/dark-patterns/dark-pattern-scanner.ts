import type { DarkPatternType } from '../../chat/tool-card.model'

export interface Finding {
  type: DarkPatternType
  element: Element
  evidence: string
  /** Text-based findings the model must confirm. */
  needsModel: boolean
  /** Timer that restarted after a reload. */
  likelyFake?: boolean
}

const EXTRAS =
  /newsletter|marketing|insurance|protection|donat|add-?on|partner|sharing|share my|offers|promotion|updates|warranty/iu
const TIMER = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/u
const URGENCY =
  /offer|ends|left|expire|hurry|remaining|sale|deal|reserved|only/iu
const SCARCITY =
  /only \d+ left|\d+ (?:people|others|users|shoppers)(?: are)? (?:viewing|looking|watching)|selling fast|almost gone|low stock|in high demand|\d+ (?:sold|bought) in the last/iu
const DECLINE_START =
  /^(no thanks|no,|i don['’]t|i do not|not now|skip|i['’]ll pass|i prefer not|no i)/iu
const ACCEPT =
  /^(accept|agree|yes|continue|subscribe|sign me up|sign up|allow|get|claim|ok\b|add)/iu
const DECLINE = /^(no|decline|reject|cancel|skip|not now|later|maybe later)/iu
const PRICE = /[$€£¥]\s?\d|\d+[.,]\d{2}\s?(?:[$€£¥]|usd|eur|gbp)?/iu
const SNEAK =
  /added|protection plan|service fee|processing fee|insurance|donation|\btip\b|warranty|handling fee/iu
const CART = /cart|basket|summary|checkout|order/iu

const clean = (text: string | null | undefined): string =>
  (text ?? '').replace(/\s+/gu, ' ').trim()

function isVisible(element: Element): boolean {
  if ((element as HTMLElement).hidden) return false
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  return !style || (style.display !== 'none' && style.visibility !== 'hidden')
}

function labelOf(element: Element): string {
  const id = element.getAttribute('id')
  const label =
    (id &&
      element.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
    element.closest('label')
  return clean(
    label?.textContent ||
      element.getAttribute('aria-label') ||
      element.parentElement?.textContent
  )
}

/** Elements outside the chat, visible, with no element children holding the match. */
function leaves(
  doc: Document,
  host?: Element | null,
  selector = 'body *'
): Element[] {
  return Array.from(doc.querySelectorAll(selector)).filter(
    (element) =>
      !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(element.tagName) &&
      !(host && (host === element || host.contains(element))) &&
      isVisible(element)
  )
}

function ownText(element: Element): string {
  return clean(
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' ')
  )
}

export function findPrechecked(
  doc: Document,
  host?: Element | null
): Finding[] {
  return leaves(
    doc,
    host,
    'input[type="checkbox"], [role="switch"][aria-checked="true"], [role="checkbox"][aria-checked="true"]'
  )
    .filter((element) =>
      element instanceof HTMLInputElement ? element.checked : true
    )
    .map((element) => ({ element, label: labelOf(element) }))
    .filter(({ label }) => EXTRAS.test(label))
    .map(({ element, label }) => ({
      type: 'prechecked' as const,
      element,
      evidence: label.slice(0, 200),
      needsModel: false
    }))
}

/** Text like 09:59 near "offer", "ends" or "left". */
export function timerCandidates(
  doc: Document,
  host?: Element | null
): Element[] {
  return leaves(doc, host).filter((element) => {
    const text = ownText(element)
    if (!TIMER.test(text)) return false
    const near = clean(
      element.parentElement?.parentElement?.textContent ??
        element.parentElement?.textContent
    ).slice(0, 300)
    return URGENCY.test(near)
  })
}

export function timerSeconds(text: string): number | null {
  const match = text.match(TIMER)
  if (!match) return null
  const parts = match
    .slice(1)
    .filter((part) => part !== undefined)
    .map(Number)
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function findScarcity(doc: Document, host?: Element | null): Finding[] {
  return leaves(doc, host)
    .filter((element) => SCARCITY.test(ownText(element)))
    .map((element) => ({
      type: 'scarcity' as const,
      element,
      evidence: ownText(element).slice(0, 200),
      needsModel: true
    }))
}

const clickables = (doc: Document, host?: Element | null): Element[] =>
  leaves(
    doc,
    host,
    'button, a, [role="button"], input[type="button"], input[type="submit"]'
  )

const textOf = (element: Element): string =>
  clean(
    element instanceof HTMLInputElement ? element.value : element.textContent
  )

export function findShaming(doc: Document, host?: Element | null): Finding[] {
  return clickables(doc, host)
    .filter((element) => {
      const text = textOf(element)
      return text.length > 15 && DECLINE_START.test(text)
    })
    .map((element) => ({
      type: 'shaming' as const,
      element,
      evidence: textOf(element).slice(0, 200),
      needsModel: true
    }))
}

function luminance(color: string): number | null {
  const match = color.match(
    /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/u
  )
  if (!match) return null
  if (match[4] !== undefined && Number(match[4]) < 0.1) return null
  const [r, g, b] = match.slice(1, 4).map((value) => {
    const c = Number(value) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast of an element's text against its own or its parent's background. */
export function contrastOf(element: Element): number | null {
  const view = element.ownerDocument.defaultView
  if (!view) return null
  const text = luminance(view.getComputedStyle(element).color)
  let background: number | null = null
  for (
    let node: Element | null = element;
    node && background === null;
    node = node.parentElement
  ) {
    background = luminance(view.getComputedStyle(node).backgroundColor)
  }
  if (text === null) return null
  const bg = background ?? 1
  return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05)
}

export function findWeakDecline(
  doc: Document,
  host?: Element | null
): Finding[] {
  const found: Finding[] = []
  const view = doc.defaultView
  for (const decline of clickables(doc, host).filter((element) =>
    DECLINE.test(textOf(element))
  )) {
    const container =
      decline.parentElement?.parentElement ?? decline.parentElement
    const accept =
      container &&
      clickables(doc, host).find(
        (element) =>
          element !== decline &&
          container.contains(element) &&
          ACCEPT.test(textOf(element))
      )
    if (!accept || !view) continue
    const size = (element: Element) =>
      parseFloat(view.getComputedStyle(element).fontSize) || 0
    const area = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return rect.width * rect.height
    }
    const smallFont = size(accept) > 0 && size(decline) / size(accept) < 0.6
    const smallArea =
      area(accept) > 0 && area(decline) / area(accept) < 0.6 * 0.6
    const declineContrast = contrastOf(decline)
    const acceptContrast = contrastOf(accept)
    const faint =
      declineContrast !== null &&
      acceptContrast !== null &&
      declineContrast < 3 &&
      declineContrast < acceptContrast / 2
    if (smallFont || smallArea || faint) {
      found.push({
        type: 'weak-decline',
        element: decline,
        evidence: `"${textOf(decline)}" vs "${textOf(accept)}"`.slice(0, 200),
        needsModel: false
      })
    }
  }
  return found
}

export function findSneak(doc: Document, host?: Element | null): Finding[] {
  const carts = leaves(doc, host).filter((element) =>
    CART.test(
      `${typeof element.className === 'string' ? element.className : ''} ${element.id}`
    )
  )
  const lines = new Set<Element>()
  for (const cart of carts) {
    for (const line of Array.from(cart.querySelectorAll('li, tr, div, p'))) {
      const text = clean(line.textContent)
      if (
        text.length < 200 &&
        SNEAK.test(text) &&
        PRICE.test(text) &&
        !Array.from(line.children).some(
          (child) =>
            SNEAK.test(clean(child.textContent)) &&
            PRICE.test(clean(child.textContent))
        )
      ) {
        lines.add(line)
      }
    }
  }
  return [...lines].map((element) => ({
    type: 'sneak' as const,
    element,
    evidence: clean(element.textContent).slice(0, 200),
    needsModel: true
  }))
}

export function findHardCancel(
  doc: Document,
  host?: Element | null
): Finding[] {
  const heading = doc.querySelector('h1, h2')
  const isCancelPage =
    /cancel/iu.test(doc.location?.pathname ?? '') ||
    /cancel/iu.test(heading?.textContent ?? '')
  if (!isCancelPage) return []
  const hasCancel = clickables(doc, host).some((element) =>
    /cancel/iu.test(textOf(element))
  )
  return hasCancel
    ? []
    : [
        {
          type: 'hard-cancel',
          element: heading ?? doc.body,
          evidence: clean(heading?.textContent).slice(0, 200),
          needsModel: false
        }
      ]
}

/** All findings except timers, which need two readings. */
export function scanDarkPatterns(
  doc: Document,
  host?: Element | null
): Finding[] {
  return [
    ...findPrechecked(doc, host),
    ...findScarcity(doc, host),
    ...findShaming(doc, host),
    ...findWeakDecline(doc, host),
    ...findSneak(doc, host),
    ...findHardCancel(doc, host)
  ]
}
