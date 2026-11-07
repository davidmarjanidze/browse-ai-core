import { BookmarkRecord, Bookmarks } from '../core/storage-data'

export interface CategoryMerge {
  from: string[]
  to: string
}

export function buildCategorizationPrompt(
  existingCategories: string[]
): string {
  return `
Classify the current page into exactly one bookmark category.

EXISTING CATEGORIES:
${JSON.stringify(existingCategories)}

RULES:
- Prefer an existing category if it clearly matches.
- Prefer broad umbrella categories over narrow sub-topic categories.
- Do not create highly granular categories like "Angular Signals", "Angular Directives", or "Angular Docs" when "Angular" is a reasonable umbrella.
- If none match, create a short broad category name (max 3 words).
- Category name must be in English.
- Output JSON only.

OUTPUT FORMAT:
{
  "category": "<category name>"
}
`
}

export function buildReorganizationPrompt(bookmarks: Bookmarks): string {
  const names = Object.keys(bookmarks)
  const input = names.map((category) => ({
    category,
    urls: (bookmarks[category] ?? []).map((entry) => entry.url)
  }))

  return `
You are reorganizing bookmark categories.

TASK:
- Analyze category names and their URLs.
- Find categories that serve the same purpose and can be merged.
- Compress overly granular names into broader umbrella names.

RULES:
- Keep category names in English.
- Prefer existing broad names when possible.
- Do not invent very specific names.
- The "from" array MUST contain only exact names from ALLOWED_CATEGORY_NAMES.
- The "to" value MUST be either an existing category from ALLOWED_CATEGORY_NAMES or a short umbrella name.
- Each category can appear in at most one merge group.
- Do not include single-category merges.
- Output JSON only (no markdown, no explanations).

ALLOWED_CATEGORY_NAMES:
${JSON.stringify(names, null, 2)}

CATEGORY_INPUT:
${JSON.stringify(input, null, 2)}

OUTPUT FORMAT (STRICT):
{
  "merges": [
    {
      "from": ["Angular Signals", "Angular Forms", "Angular Docs"],
      "to": "Angular"
    }
  ]
}
`
}

/** Splits bookmarks into groups whose prompt JSON stays under `maxBytes`. */
export function chunkBookmarks(
  bookmarks: Bookmarks,
  maxBytes: number
): Bookmarks[] {
  const encoder = new TextEncoder()
  const size = (category: string, entries: BookmarkRecord[]): number =>
    encoder.encode(
      JSON.stringify({ category, urls: entries.map((entry) => entry.url) })
    ).length

  const chunks: Bookmarks[] = []
  let current: Bookmarks = {}
  let currentSize = 0
  const flush = (): void => {
    if (Object.keys(current).length === 0) return
    chunks.push(current)
    current = {}
    currentSize = 0
  }

  for (const [category, entries] of Object.entries(bookmarks)) {
    const fullSize = size(category, entries)
    if (fullSize <= maxBytes) {
      if (currentSize > 0 && currentSize + fullSize > maxBytes) flush()
      current[category] = entries
      currentSize += fullSize
      continue
    }

    flush()
    let part: BookmarkRecord[] = []
    for (const entry of entries) {
      if (part.length > 0 && size(category, [...part, entry]) > maxBytes) {
        chunks.push({ [category]: part })
        part = [entry]
      } else {
        part.push(entry)
      }
    }
    if (part.length > 0) chunks.push({ [category]: part })
  }

  flush()
  return chunks
}

/**
 * Keeps only merges that make sense for `bookmarks`: names are resolved to
 * existing categories (or a page title to its only category), and a category
 * is used in one merge at most.
 */
export function normalizeMerges(
  value: unknown,
  bookmarks: Bookmarks
): CategoryMerge[] {
  const merges = (value as { merges?: unknown } | null)?.merges
  if (!Array.isArray(merges)) return []

  const existing = new Set(Object.keys(bookmarks))
  const titleToCategories = new Map<string, Set<string>>()
  for (const [category, entries] of Object.entries(bookmarks)) {
    for (const { title } of entries) {
      const key = title.trim()
      if (!key) continue
      const categories = titleToCategories.get(key) ?? new Set<string>()
      categories.add(category)
      titleToCategories.set(key, categories)
    }
  }

  const resolve = (candidate: string): string | null => {
    if (!candidate) return null
    if (existing.has(candidate)) return candidate
    const categories = titleToCategories.get(candidate)
    return categories?.size === 1 ? [...categories][0] : null
  }

  const used = new Set<string>()
  const result: CategoryMerge[] = []

  for (const item of merges) {
    const from = (item as { from?: unknown })?.from
    const to = (item as { to?: unknown })?.to
    if (!Array.isArray(from) || typeof to !== 'string' || !to.trim()) continue

    const target = resolve(to.trim()) ?? to.trim()
    const sources = [
      ...new Set(
        from
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => resolve(entry.trim()))
          .filter(
            (entry): entry is string => entry !== null && entry !== target
          )
      )
    ]
    if (sources.length === 0 || sources.some((source) => used.has(source)))
      continue

    sources.forEach((source) => used.add(source))
    result.push({ from: sources, to: target })
  }

  return result
}

/** Moves bookmarks from merged categories into the target, without duplicates. */
export function applyMerges(
  bookmarks: Bookmarks,
  merges: CategoryMerge[]
): Bookmarks {
  const next: Bookmarks = Object.fromEntries(
    Object.entries(bookmarks).map(([category, entries]) => [
      category,
      [...entries]
    ])
  )

  for (const merge of merges) {
    const target = merge.to.trim()
    if (!target) continue
    const sources = [
      ...new Set(
        merge.from
          .map((name) => name.trim())
          .filter((name) => name && name !== target)
      )
    ]
    if (sources.length === 0) continue

    const entries = [...(next[target] ?? [])]
    const seen = new Set(entries.map((entry) => entry.url))
    for (const source of sources) {
      for (const entry of next[source] ?? []) {
        if (seen.has(entry.url)) continue
        entries.push(entry)
        seen.add(entry.url)
      }
      delete next[source]
    }
    if (entries.length > 0) next[target] = entries
  }

  return next
}

/**
 * Adds a page to a category, newest first. A new category goes to the top.
 * Returns `null` when the page is already in that category.
 */
export function addBookmark(
  bookmarks: Bookmarks,
  category: string,
  record: BookmarkRecord
): Bookmarks | null {
  const entries = bookmarks[category] ?? []
  if (entries.some((entry) => entry.url === record.url)) return null

  if (category in bookmarks) {
    return { ...bookmarks, [category]: [record, ...entries] }
  }
  return { [category]: [record], ...bookmarks }
}
