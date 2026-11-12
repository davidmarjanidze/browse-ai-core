import { isOffLimits, walkElements } from './page-snapshot'

/** Fewest repeated items that count as a list. */
const MIN_ITEMS = 3
/** Containers checked when looking for the list, so big pages stay fast. */
const MAX_CONTAINERS = 5_000

const CURRENCY =
  '[$€£¥₹₩₺₴₾₽]|(?<!\\p{L})(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|GEL|SEK|NOK|DKK|PLN|CZK|HUF|RUB|TRY|UAH|BRL|MXN|kr|zł|Kč|lei)(?!\\p{L})'
/** `1 299,00`, `1.299`, `1299.99`, `12`. Spaces only between groups of 3. */
const AMOUNT =
  '(?:\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?!\\d)'
const PRICE = new RegExp(
  `(${CURRENCY})\\s?(${AMOUNT})|(${AMOUNT})\\s?(${CURRENCY})`,
  'u'
)
const RATING = /(\d(?:[.,]\d{1,2})?)\s*(?:out of\s*5|\/\s*5|of\s*5|stars?)/iu

export interface Price {
  amount: number
  currency: string
}

export interface ListItem {
  element: Element
  title: string
  price: Price | null
  rating: number | null
  href: string
}

/** `1.299,00` → 1299, `1,299` → 1299, `12.5` → 12.5. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[\s  ]/gu, '')
  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','))
  if (last < 0) return Number(digits)
  const decimals = digits.length - last - 1
  const whole = digits.slice(0, last).replace(/[.,]/gu, '')
  return decimals === 1 || decimals === 2
    ? Number(`${whole}.${digits.slice(last + 1)}`)
    : Number(digits.replace(/[.,]/gu, ''))
}

/** The first price in a text, or null. */
export function parsePrice(text: string): Price | null {
  const match = PRICE.exec(text)
  if (!match) return null
  const amount = parseAmount(match[2] ?? match[3] ?? '')
  return Number.isFinite(amount)
    ? { amount, currency: (match[1] ?? match[4] ?? '').trim() }
    : null
}

function isStruck(node: Node, item: Element): boolean {
  for (
    let element = node.parentElement;
    element && element !== item.parentElement;
    element = element.parentElement
  ) {
    if (/^(DEL|S|STRIKE)$/u.test(element.tagName)) return true
    const line =
      element.ownerDocument.defaultView?.getComputedStyle(element)
        .textDecorationLine ?? ''
    if (line.includes('line-through')) return true
  }
  return false
}

/** The item's price, skipping a struck-through old price when there is another. */
export function priceOf(item: Element): Price | null {
  const walker = item.ownerDocument.createTreeWalker(item, NodeFilter.SHOW_TEXT)
  const kept: string[] = []
  const struck: string[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (!/\d/u.test(text)) continue
    ;(isStruck(node, item) ? struck : kept).push(text)
  }
  return parsePrice(kept.join(' ')) ?? parsePrice(struck.join(' '))
}

/** A 0-5 rating from `ratingValue`, a label like "4.5 out of 5", or text. */
export function ratingOf(item: Element): number | null {
  const meta = item.querySelector('[itemprop=ratingValue]')
  const labels = [...item.querySelectorAll('[aria-label], [title]')].map(
    (element) =>
      `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`
  )
  const sources = [
    meta?.getAttribute('content') ?? meta?.textContent ?? '',
    ...labels,
    item.textContent ?? ''
  ]
  for (const [index, source] of sources.entries()) {
    const value =
      index === 0 && source.trim()
        ? Number(source.trim().replace(',', '.'))
        : Number(RATING.exec(source)?.[1]?.replace(',', '.'))
    if (Number.isFinite(value) && value >= 0 && value <= 5) return value
  }
  return null
}

const clean = (text: string | null | undefined, max = 80): string =>
  (text ?? '').replace(/\s+/gu, ' ').trim().slice(0, max)

function titleOf(item: Element): string {
  const named = item.querySelector(
    'h1, h2, h3, h4, h5, h6, [itemprop=name], [class*="title" i], [class*="name" i]'
  )
  const link = item.querySelector('a[href]')
  return clean(
    named?.textContent ||
      link?.getAttribute('aria-label') ||
      link?.textContent ||
      item.textContent
  )
}

function isHidden(element: Element): boolean {
  if (element.hasAttribute('hidden')) return true
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  return style?.display === 'none' || style?.visibility === 'hidden'
}

/** The children that repeat most (same tag and class), at least 3. */
export function repeatedChildren(container: Element): Element[] {
  const groups = new Map<string, Element[]>()
  for (const child of container.children) {
    if (isHidden(child) || !clean(child.textContent)) continue
    const key = `${child.tagName}.${[...child.classList].sort().join('.')}`
    groups.set(key, [...(groups.get(key) ?? []), child])
  }
  let best: Element[] = []
  for (const group of groups.values())
    if (group.length > best.length) best = group
  return best.length >= MIN_ITEMS ? best : []
}

/** Lists with prices score higher than menus of the same size. */
function score(items: Element[]): number {
  const priced = items.filter((item) => PRICE.test(item.textContent ?? ''))
  return items.length * (1 + (2 * priced.length) / items.length)
}

/**
 * The repeated items of the list that holds `from` (the element or its
 * closest ancestor with repeated children), or of the biggest list on the
 * page when `from` is null.
 */
export function findListItems(
  doc: Document,
  host: Element | null,
  from: Element | null
): Element[] {
  if (from) {
    for (
      let element: Element | null = from;
      element;
      element = element.parentElement
    ) {
      const items = repeatedChildren(element)
      if (items.length) return items
    }
    return []
  }
  let best: Element[] = []
  let bestScore = 0
  let checked = 0
  for (const element of walkElements(doc)) {
    if (element.children.length < MIN_ITEMS) continue
    if (++checked > MAX_CONTAINERS) break
    if (isOffLimits(element, host) || isHidden(element)) continue
    const items = repeatedChildren(element)
    const value = items.length ? score(items) : 0
    if (value > bestScore) {
      best = items
      bestScore = value
    }
  }
  return best
}

/** Title, price, rating and link of each item. */
export function readItems(items: Element[]): ListItem[] {
  return items.map((item) => {
    const link = item.matches('a[href]') ? item : item.querySelector('a[href]')
    return {
      element: link ?? item.querySelector('button') ?? item,
      title: titleOf(item),
      price: priceOf(item),
      rating: ratingOf(item),
      href: clean(link?.getAttribute('href'), 60)
    }
  })
}

/** Sorts by price or rating; items without the value go last. */
export function sortItems(
  items: ListItem[],
  by: 'price' | 'rating',
  order: 'asc' | 'desc'
): ListItem[] {
  const value = (item: ListItem): number | null =>
    by === 'price' ? (item.price?.amount ?? null) : item.rating
  const sign = order === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === null || right === null)
      return left === null ? (right === null ? 0 : 1) : -1
    return (left - right) * sign
  })
}
