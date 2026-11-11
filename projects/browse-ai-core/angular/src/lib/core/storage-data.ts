import { PaletteName, ThemeMode, isPaletteName } from 'browse-ai-core'
import { NotesData, normalizeNotes } from './notes-data'
import { ResearchData, normalizeResearch } from './research-data'

export interface Personalization {
  nickname: string
  customInstructions: string
}

export interface BookmarkRecord {
  title: string
  url: string
}

/** Category name to the pages saved in it, newest first. */
export type Bookmarks = Record<string, BookmarkRecord[]>

/** Side of the window the launcher and panel sit on. */
export type ChatSide = 'left' | 'right'

export interface Appearance {
  theme?: ThemeMode
  palette?: PaletteName
  side?: ChatSide
}

export interface Preferences {
  /** Show actions when the user selects page text. */
  selectionActions: boolean
  /** Last used Research Notes topic. */
  researchTopic?: string
}

export interface StorageData {
  personalization: Personalization
  preferences: Preferences
  bookmarks: {
    aiBookmarksEnabled: boolean
    bookmarkReorganizationCounter: number
    bookmarksData: Bookmarks
  }
  appearance: Appearance
  notes: NotesData
  research: ResearchData
}

export function createDefaultStorageData(): StorageData {
  return {
    personalization: { nickname: '', customInstructions: '' },
    preferences: { selectionActions: true },
    bookmarks: {
      aiBookmarksEnabled: true,
      bookmarkReorganizationCounter: 0,
      bookmarksData: {}
    },
    appearance: {},
    notes: {},
    research: {}
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function isBookmarks(value: unknown): value is Bookmarks {
  return (
    isObject(value) &&
    Object.values(value).every(
      (entries) =>
        Array.isArray(entries) &&
        entries.every(
          (entry) =>
            isObject(entry) &&
            typeof entry['title'] === 'string' &&
            typeof entry['url'] === 'string'
        )
    )
  )
}

function normalizePersonalization(value: unknown): Personalization {
  const source = isObject(value) ? value : {}
  return {
    nickname: typeof source['nickname'] === 'string' ? source['nickname'] : '',
    customInstructions:
      typeof source['customInstructions'] === 'string'
        ? source['customInstructions']
        : ''
  }
}

function normalizeAppearance(value: unknown): Appearance {
  if (!isObject(value)) return {}
  const theme = value['theme']
  return {
    ...(theme === 'light' || theme === 'dark' || theme === 'system'
      ? { theme }
      : {}),
    ...(isPaletteName(value['palette']) ? { palette: value['palette'] } : {}),
    ...(value['side'] === 'left' || value['side'] === 'right'
      ? { side: value['side'] }
      : {})
  }
}

/**
 * Turns whatever is in storage into valid data. Also reads the older format
 * where `aiBookmarksEnabled` and `bookmarks` were top-level keys.
 */
export function normalizeStorageData(value: unknown): StorageData {
  const base = normalizeBaseData(value)
  if (!isObject(value)) return base
  return {
    ...base,
    notes: normalizeNotes(value['notes']),
    research: normalizeResearch(value['research'])
  }
}

function normalizeBaseData(value: unknown): StorageData {
  const defaults = createDefaultStorageData()
  if (!isObject(value)) return defaults

  const bookmarks = value['bookmarks']
  const appearance = normalizeAppearance(value['appearance'])
  const personalization = normalizePersonalization(value['personalization'])
  const storedPreferences = isObject(value['preferences'])
    ? value['preferences']
    : {}
  const researchTopic = storedPreferences['researchTopic']
  const preferences: Preferences = {
    selectionActions: storedPreferences['selectionActions'] !== false,
    ...(typeof researchTopic === 'string' ? { researchTopic } : {})
  }

  if (isObject(bookmarks) && isBookmarks(bookmarks['bookmarksData'])) {
    const counter = Number(bookmarks['bookmarkReorganizationCounter'])
    return {
      personalization,
      preferences,
      appearance,
      bookmarks: {
        aiBookmarksEnabled: bookmarks['aiBookmarksEnabled'] !== false,
        bookmarkReorganizationCounter: Number.isFinite(counter)
          ? Math.max(0, Math.floor(counter))
          : 0,
        bookmarksData: bookmarks['bookmarksData']
      },
      notes: {},
      research: {}
    }
  }

  if (isBookmarks(bookmarks)) {
    return {
      personalization,
      preferences,
      appearance,
      bookmarks: {
        aiBookmarksEnabled: value['aiBookmarksEnabled'] !== false,
        bookmarkReorganizationCounter: 0,
        bookmarksData: bookmarks
      },
      notes: {},
      research: {}
    }
  }

  return { ...defaults, personalization, preferences, appearance }
}
