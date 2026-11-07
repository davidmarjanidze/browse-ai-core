import { Injectable, inject } from '@angular/core'
import { ConfigStore } from './config.store'
import {
  Appearance,
  Bookmarks,
  Personalization,
  Preferences,
  StorageData,
  normalizeStorageData
} from './storage-data'

/**
 * Reads and writes all saved data as one value under `config.storageKey`,
 * using the configured storage adapter. Writes run one after another so
 * read-modify-write updates never overwrite each other.
 */
@Injectable()
export class StorageService {
  readonly #config = inject(ConfigStore).config
  #writeChain: Promise<unknown> = Promise.resolve()

  async load(): Promise<StorageData> {
    const { storage, storageKey } = this.#config()
    try {
      return normalizeStorageData(await storage.get(storageKey))
    } catch {
      return normalizeStorageData(undefined)
    }
  }

  async loadPersonalization(): Promise<Personalization> {
    return (await this.load()).personalization
  }

  async loadAppearance(): Promise<Appearance> {
    return (await this.load()).appearance
  }

  async loadBookmarks(): Promise<Bookmarks> {
    return (await this.load()).bookmarks.bookmarksData
  }

  async loadAiBookmarksEnabled(): Promise<boolean> {
    return (await this.load()).bookmarks.aiBookmarksEnabled
  }

  async loadPreferences(): Promise<Preferences> {
    return (await this.load()).preferences
  }

  setPreferences(preferences: Partial<Preferences>): Promise<void> {
    return this.update((data) => ({
      ...data,
      preferences: { ...data.preferences, ...preferences }
    }))
  }

  setPersonalization(personalization: Personalization): Promise<void> {
    return this.update((data) => ({ ...data, personalization }))
  }

  setAppearance(appearance: Appearance): Promise<void> {
    return this.update((data) => ({
      ...data,
      appearance: { ...data.appearance, ...appearance }
    }))
  }

  setBookmarks(bookmarksData: Bookmarks): Promise<void> {
    return this.update((data) => ({
      ...data,
      bookmarks: { ...data.bookmarks, bookmarksData }
    }))
  }

  setAiBookmarksEnabled(aiBookmarksEnabled: boolean): Promise<void> {
    return this.update((data) => ({
      ...data,
      bookmarks: { ...data.bookmarks, aiBookmarksEnabled }
    }))
  }

  /** Counts an added bookmark. True every `threshold` additions. */
  async trackBookmarkAddition(threshold = 5): Promise<boolean> {
    let shouldReorganize = false
    await this.update((data) => {
      const counter = data.bookmarks.bookmarkReorganizationCounter + 1
      shouldReorganize = counter >= threshold
      return {
        ...data,
        bookmarks: {
          ...data.bookmarks,
          bookmarkReorganizationCounter: shouldReorganize ? 0 : counter
        }
      }
    })
    return shouldReorganize
  }

  update(updater: (data: StorageData) => StorageData): Promise<void> {
    const write = this.#writeChain.then(async () => {
      const { storage, storageKey } = this.#config()
      const next = updater(await this.load())
      await storage.set(storageKey, next)
    })

    this.#writeChain = write.catch((error: unknown) => {
      console.error('browse-ai-core: could not save data', error)
    })
    return this.#writeChain as Promise<void>
  }
}
