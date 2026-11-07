import { cleanModelText } from '../ai/json-response'

export interface NoteRecord {
  id: string
  /** Text the user highlighted. Empty for whole-page notes. */
  quote: string
  note: string
  /** Page text right before and after the quote, to find it again. */
  before: string
  after: string
  createdAt: string
}

export interface NotesPage {
  url: string
  /** The page's `<title>` when the first note was saved. */
  title: string
  favicon?: string
  updatedAt: string
  notes: NoteRecord[]
}

/** Hostname to page URL to page. */
export type NotesData = Record<string, Record<string, NotesPage>>

export interface NotesSite {
  host: string
  favicon?: string
  pageCount: number
  noteCount: number
  updatedAt: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

function normalizeNote(value: unknown): NoteRecord | null {
  if (!isObject(value) || !isString(value['id']) || !isString(value['note']))
    return null
  return {
    id: value['id'],
    // Older notes may still have <note> tags from the model.
    note: cleanModelText(value['note']),
    quote: isString(value['quote']) ? value['quote'] : '',
    before: isString(value['before']) ? value['before'] : '',
    after: isString(value['after']) ? value['after'] : '',
    createdAt: isString(value['createdAt']) ? value['createdAt'] : ''
  }
}

/** Keeps valid sites, pages and notes and drops the rest. */
export function normalizeNotes(value: unknown): NotesData {
  if (!isObject(value)) return {}
  const result: NotesData = {}
  for (const [host, pages] of Object.entries(value)) {
    if (!isObject(pages)) continue
    for (const [url, page] of Object.entries(pages)) {
      if (!isObject(page) || !Array.isArray(page['notes'])) continue
      const notes = page['notes']
        .map(normalizeNote)
        .filter((note): note is NoteRecord => note !== null)
      if (notes.length === 0) continue
      result[host] ??= {}
      result[host][url] = {
        url,
        title: isString(page['title']) ? page['title'] : '',
        ...(isString(page['favicon']) ? { favicon: page['favicon'] } : {}),
        updatedAt: isString(page['updatedAt']) ? page['updatedAt'] : '',
        notes
      }
    }
  }
  return result
}

/** The page key: the URL without the hash. */
export function pageKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.href
  } catch {
    return url.split('#')[0]
  }
}

/** The site key: the hostname without `www.`. */
export function siteKey(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./iu, '').toLowerCase()
  } catch {
    return ''
  }
}

export function addNotes(
  data: NotesData,
  page: { url: string; title: string; favicon?: string },
  notes: NoteRecord[],
  now = new Date().toISOString()
): NotesData {
  const host = siteKey(page.url)
  const url = pageKey(page.url)
  const existing = data[host]?.[url]
  const next: NotesPage = existing
    ? { ...existing, updatedAt: now, notes: [...existing.notes, ...notes] }
    : {
        url,
        title: page.title,
        ...(page.favicon ? { favicon: page.favicon } : {}),
        updatedAt: now,
        notes
      }
  return { ...data, [host]: { ...data[host], [url]: next } }
}

export function deleteNote(
  data: NotesData,
  url: string,
  id: string
): NotesData {
  const host = siteKey(url)
  const page = data[host]?.[url]
  if (!page) return data
  const notes = page.notes.filter((note) => note.id !== id)
  return notes.length
    ? { ...data, [host]: { ...data[host], [url]: { ...page, notes } } }
    : deletePage(data, url)
}

export function deletePage(data: NotesData, url: string): NotesData {
  const host = siteKey(url)
  if (!data[host]?.[url]) return data
  const { [url]: _removed, ...pages } = data[host]
  const next = { ...data }
  if (Object.keys(pages).length) next[host] = pages
  else delete next[host]
  return next
}

const newestFirst = <T extends { updatedAt: string }>(a: T, b: T): number =>
  b.updatedAt.localeCompare(a.updatedAt)

export function listSites(data: NotesData): NotesSite[] {
  return Object.entries(data)
    .map(([host, pages]) => {
      const list = Object.values(pages).sort(newestFirst)
      return {
        host,
        favicon: list.find((page) => page.favicon)?.favicon,
        pageCount: list.length,
        noteCount: list.reduce((sum, page) => sum + page.notes.length, 0),
        updatedAt: list[0]?.updatedAt ?? ''
      }
    })
    .sort(newestFirst)
}

export function listPages(data: NotesData, host: string): NotesPage[] {
  return Object.values(data[host] ?? {}).sort(newestFirst)
}

/** Pages where the site, title, quotes or notes contain `query`. */
export function searchPages(data: NotesData, query: string): NotesPage[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return Object.entries(data)
    .flatMap(([host, pages]) =>
      Object.values(pages).filter(
        (page) =>
          host.includes(needle) ||
          page.title.toLowerCase().includes(needle) ||
          page.notes.some(
            (note) =>
              note.note.toLowerCase().includes(needle) ||
              note.quote.toLowerCase().includes(needle)
          )
      )
    )
    .sort(newestFirst)
}

/** Label for a page: its title, or its path when it has no title. */
export function pageLabel(page: NotesPage): string {
  if (page.title.trim()) return page.title.trim()
  try {
    return new URL(page.url).pathname
  } catch {
    return page.url
  }
}

export function pageToMarkdown(page: NotesPage): string {
  const lines = [`# ${pageLabel(page)}`, '', page.url, '']
  for (const note of page.notes) {
    if (note.quote)
      lines.push(...note.quote.split('\n').map((line) => `> ${line}`), '')
    if (note.note) lines.push(note.note, '')
    lines.push(`_${note.createdAt.slice(0, 10)}_`, '')
  }
  return lines.join('\n')
}
