import { isOffLimits, walkElements } from './page-snapshot'

/** Images smaller than this on both sides are icons and are skipped. */
const MIN_IMAGE_SIZE = 48
/** Elements checked for a CSS background image, so big pages stay fast. */
const MAX_BACKGROUND_CHECKS = 3_000

export interface ImageHit {
  element: Element
  /** Alt, title, caption or file name. */
  label: string
  /** Every text the search matches against, lower case. */
  search: string
  width: number
  height: number
  place: 'in view' | 'above' | 'below'
}

const clean = (text: string | null | undefined, max = 80): string =>
  (text ?? '').replace(/\s+/gu, ' ').trim().slice(0, max)

/** `photos/red-plane_2.jpg?w=300` → `red plane 2`. */
export function fileNameOf(url: string): string {
  const path = url.split(/[?#]/u)[0] ?? ''
  let last = path.split('/').pop() ?? ''
  try {
    last = decodeURIComponent(last)
  } catch {
    // Keeps the raw name.
  }
  return clean(last.replace(/\.[a-z0-9]{2,5}$/iu, '').replace(/[-_.+]+/gu, ' '))
}

function backgroundUrl(element: Element): string {
  const image =
    element.ownerDocument.defaultView?.getComputedStyle(element)
      .backgroundImage ?? ''
  return image.match(/url\(["']?(.*?)["']?\)/u)?.[1] ?? ''
}

function imageUrl(element: Element): string {
  if (element instanceof HTMLImageElement)
    return element.currentSrc || element.src
  if (element.tagName.toLowerCase() === 'picture')
    return element.querySelector('img')?.src ?? ''
  return ''
}

/** Text near the image that says what it shows. */
function captionOf(element: Element): string {
  const figure = element.closest('figure')?.querySelector('figcaption')
  if (figure) return clean(figure.textContent)
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy)
    return clean(element.ownerDocument.getElementById(labelledBy)?.textContent)
  const link = element.closest('a')
  return link
    ? clean(link.getAttribute('aria-label') || link.textContent || '')
    : ''
}

function ownLabel(element: Element): string {
  const svgTitle =
    element.tagName.toLowerCase() === 'svg'
      ? element.querySelector('title')?.textContent
      : ''
  const img =
    element.tagName.toLowerCase() === 'picture'
      ? element.querySelector('img')
      : element
  return clean(
    img?.getAttribute('alt') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      svgTitle
  )
}

function isImage(element: Element, checks: { left: number }): boolean {
  const tag = element.tagName.toLowerCase()
  if (tag === 'img') return !element.closest('picture')
  if (tag === 'picture') return true
  if (tag === 'svg')
    return (
      element.querySelector('title') !== null ||
      element.hasAttribute('aria-label')
    )
  if (checks.left <= 0) return false
  checks.left--
  return backgroundUrl(element) !== ''
}

/** Images on the page, big enough to be content, in page order. */
export function listImages(doc: Document, host: Element | null): ImageHit[] {
  const height = doc.defaultView?.innerHeight ?? 800
  const checks = { left: MAX_BACKGROUND_CHECKS }
  const hits: ImageHit[] = []
  for (const element of walkElements(doc)) {
    if (!isImage(element, checks) || isOffLimits(element, host)) continue
    const rect = element.getBoundingClientRect()
    if (rect.width < MIN_IMAGE_SIZE && rect.height < MIN_IMAGE_SIZE) continue
    const style = doc.defaultView?.getComputedStyle(element)
    if (style?.display === 'none' || style?.visibility === 'hidden') continue
    const url = imageUrl(element) || backgroundUrl(element)
    const own = ownLabel(element)
    const caption = captionOf(element)
    const file = url.startsWith('data:') ? '' : fileNameOf(url)
    hits.push({
      element,
      label: own || caption || file || 'no description',
      search: `${own} ${caption} ${file}`.toLowerCase(),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      place:
        rect.bottom <= 0 ? 'above' : rect.top >= height ? 'below' : 'in view'
    })
  }
  return hits
}

/** Words of a search, lower case, at least 2 letters. */
export const searchWords = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2)

/** Images that match any word, most matches first, then page order. */
export function matchImages(hits: ImageHit[], text: string): ImageHit[] {
  const words = searchWords(text)
  if (!words.length) return hits
  return hits
    .map((hit, index) => ({
      hit,
      index,
      score: words.filter((word) => hit.search.includes(word)).length
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.hit)
}
