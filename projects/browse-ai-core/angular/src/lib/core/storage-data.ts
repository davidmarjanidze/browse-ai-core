import { PaletteName, ThemeMode, isPaletteName } from 'browse-ai-core'

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

export interface Appearance {
  theme?: ThemeMode
  palette?: PaletteName
}

export interface Preferences {
  /** Show actions when the user selects page text. */
  selectionActions: boolean
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
    appearance: {}
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
    ...(isPaletteName(value['palette']) ? { palette: value['palette'] } : {})
  }
}

/**
 * Turns whatever is in storage into valid data. Also reads the older format
 * where `aiBookmarksEnabled` and `bookmarks` were top-level keys.
 */
export function normalizeStorageData(value: unknown): StorageData {
  const defaults = createDefaultStorageData()
  if (!isObject(value)) return defaults

  const bookmarks = value['bookmarks']
  const appearance = normalizeAppearance(value['appearance'])
  const personalization = normalizePersonalization(value['personalization'])
  const preferences: Preferences = {
    selectionActions: !(
      isObject(value['preferences']) &&
      value['preferences']['selectionActions'] === false
    )
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
      }
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
      }
    }
  }

  return { ...defaults, personalization, preferences, appearance }
}
