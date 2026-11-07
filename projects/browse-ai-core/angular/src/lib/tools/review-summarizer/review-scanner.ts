import type { ReviewStats } from '../../chat/tool-card.model'

export interface FoundReview {
  text: string
  /** Rating on a 1 to 5 scale, or null. */
  rating: number | null
  date: string
}

const MIN_TEXT = 40
const KEYWORD = /review|comment/iu

const clean = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/gu, ' ').trim()

/** Reads "4.5 out of 5", "4/5", "Rated 3 of 5" and similar. */
export function parseRatingText(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:out of|of|\/)\s*(\d+)/iu)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  const best = Number(match[2])
  if (!best || value < 0 || value > best) return null
  return Math.round((value / best) * 5 * 10) / 10
}

function toFive(value: unknown, best: unknown): number | null {
  const rating = Number(value)
  const scale = Number(best) || 5
  if (!Number.isFinite(rating) || rating < 0 || rating > scale) return null
  return Math.round((rating / scale) * 5 * 10) / 10
}

/** Rating from attributes, aria-labels or filled star icons inside an element. */
export function readRating(element: Element): number | null {
  const meta = element.querySelector('[itemprop="ratingValue"]')
  if (meta) {
    const best = element.querySelector('[itemprop="bestRating"]')
    const rating = toFive(
      meta.getAttribute('content') ?? meta.textContent,
      best?.getAttribute('content') ?? best?.textContent
    )
    if (rating !== null) return rating
  }
  for (const node of [
    element,
    ...Array.from(element.querySelectorAll('[aria-label], [title]'))
  ]) {
    const label =
      node.getAttribute('aria-label') ?? node.getAttribute('title') ?? ''
    if (/star|rat/iu.test(label) || /out of/iu.test(label)) {
      const rating = parseRatingText(label)
      if (rating !== null) return rating
    }
  }
  const stars = Array.from(element.querySelectorAll('[class*="star" i]'))
  const filled = stars.filter((star) =>
    /full|fill|active|\bon\b|checked/iu.test(star.getAttribute('class') ?? '')
  )
  if (stars.length >= 3 && stars.length <= 10 && filled.length > 0) {
    return Math.min(5, filled.length)
  }
  return null
}

function fromJsonLd(doc: Document): FoundReview[] {
  const found: FoundReview[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (typeof node !== 'object' || node === null) return
    const record = node as Record<string, unknown>
    const type = record['@type']
    const types = Array.isArray(type) ? type : [type]
    if (types.includes('Review')) {
      const rating = record['reviewRating'] as
        Record<string, unknown> | undefined
      const text = clean(
        String(record['reviewBody'] ?? record['description'] ?? '')
      )
      if (text) {
        found.push({
          text,
          rating: rating
            ? toFive(rating['ratingValue'], rating['bestRating'])
            : null,
          date: clean(String(record['datePublished'] ?? ''))
        })
      }
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'object') visit(value)
    }
  }
  for (const script of Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  )) {
    try {
      visit(JSON.parse(script.textContent ?? ''))
    } catch {
      // Broken JSON-LD is skipped.
    }
  }
  return found
}

function fromMicrodata(doc: Document, host?: Element | null): FoundReview[] {
  return Array.from(doc.querySelectorAll('[itemtype$="/Review"]'))
    .filter((element) => !host?.contains(element))
    .map((element) => ({
      text: clean(
        element.querySelector(
          '[itemprop="reviewBody"], [itemprop="description"]'
        )?.textContent ?? element.textContent
      ),
      rating: readRating(element),
      date: clean(
        element
          .querySelector('[itemprop="datePublished"]')
          ?.getAttribute('content') ??
          element.querySelector('time')?.getAttribute('datetime')
      )
    }))
    .filter((review) => review.text.length >= MIN_TEXT)
}

function hasKeyword(element: Element): boolean {
  const className =
    typeof element.className === 'string' ? element.className : ''
  if (KEYWORD.test(className) || KEYWORD.test(element.id)) return true
  return Array.from(element.attributes).some(
    (attr) =>
      attr.name.startsWith('data-') &&
      (KEYWORD.test(attr.name) || KEYWORD.test(attr.value))
  )
}

/** Repeated elements (same tag and classes) named like reviews or comments. */
function fromRepeated(doc: Document, host?: Element | null): FoundReview[] {
  const groups = new Map<string, Element[]>()
  for (const element of Array.from(doc.body?.querySelectorAll('*') ?? [])) {
    if (host && (host === element || host.contains(element))) continue
    if (!hasKeyword(element)) continue
    if (clean(element.textContent).length < MIN_TEXT) continue
    const key = `${element.tagName}|${typeof element.className === 'string' ? element.className.trim() : ''}`
    groups.set(key, [...(groups.get(key) ?? []), element])
  }
  const candidates = [...groups.values()]
    .filter((group) => group.length >= 2)
    .flat()
  // Keep the outermost element of each review, so its rating is included.
  const outer = candidates.filter(
    (element) =>
      !candidates.some((other) => other !== element && other.contains(element))
  )
  return outer.map((element) => ({
    text: clean(element.textContent).slice(0, 2000),
    rating: readRating(element),
    date: clean(element.querySelector('time')?.getAttribute('datetime'))
  }))
}

/** Reviews on the page: JSON-LD first, then microdata, then repeated elements. */
export function scanReviews(
  doc: Document,
  host?: Element | null
): FoundReview[] {
  const sources = [fromJsonLd(doc), fromMicrodata(doc, host)]
  let reviews = sources.find((list) => list.length >= 2) ?? []
  if (reviews.length < 2) reviews = fromRepeated(doc, host)
  const seen = new Set<string>()
  return reviews.filter((review) => {
    const key = review.text.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Counts and averages ratings in code, not with the model. */
export function reviewStats(reviews: FoundReview[]): ReviewStats {
  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating): rating is number => rating !== null)
  const perStar = [0, 0, 0, 0, 0]
  for (const rating of ratings)
    perStar[Math.min(5, Math.max(1, Math.round(rating))) - 1] += 1
  const average = ratings.length
    ? Math.round(
        (ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10
      ) / 10
    : null
  return { count: reviews.length, rated: ratings.length, average, perStar }
}
