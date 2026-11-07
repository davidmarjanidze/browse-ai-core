/**
 * Where settings, personalization and bookmarks are saved. Values are plain
 * JSON. Pass your own adapter to save them somewhere else (for example your
 * backend).
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
}

interface ChromeStorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string[]): Promise<void>
}

function getChromeStorageArea(): ChromeStorageArea | null {
  const chromeApi = (
    globalThis as { chrome?: { storage?: { local?: ChromeStorageArea } } }
  ).chrome
  return chromeApi?.storage?.local ?? null
}

/** Keeps values in memory only. They are lost on page reload. */
export function memoryStorageAdapter(): StorageAdapter {
  const values = new Map<string, unknown>()

  return {
    async get<T>(key: string) {
      return values.has(key) ? structuredClone(values.get(key) as T) : undefined
    },
    async set<T>(key: string, value: T) {
      values.set(key, structuredClone(value))
    },
    async remove(key: string) {
      values.delete(key)
    }
  }
}

/** `window.localStorage`, with values saved as JSON. */
export function localStorageAdapter(): StorageAdapter {
  return {
    async get<T>(key: string) {
      const raw = globalThis.localStorage?.getItem(key)
      if (raw === null || raw === undefined) return undefined

      try {
        return JSON.parse(raw) as T
      } catch {
        return undefined
      }
    },
    async set<T>(key: string, value: T) {
      globalThis.localStorage?.setItem(key, JSON.stringify(value))
    },
    async remove(key: string) {
      globalThis.localStorage?.removeItem(key)
    }
  }
}

/**
 * `chrome.storage.local`, for browser extensions. Returns `null` when the
 * Chrome extension API is not available.
 */
export function chromeStorageAdapter(): StorageAdapter | null {
  const area = getChromeStorageArea()
  if (!area) return null

  return {
    async get<T>(key: string) {
      const result = await area.get([key])
      return result[key] as T | undefined
    },
    async set<T>(key: string, value: T) {
      await area.set({ [key]: value })
    },
    async remove(key: string) {
      await area.remove([key])
    }
  }
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage !== 'undefined'
  } catch {
    return false
  }
}

/** `chrome.storage.local` if available, then `localStorage`, then memory. */
export function defaultStorageAdapter(): StorageAdapter {
  return (
    chromeStorageAdapter() ??
    (hasLocalStorage() ? localStorageAdapter() : memoryStorageAdapter())
  )
}
