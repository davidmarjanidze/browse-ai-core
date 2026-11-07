import { DOCUMENT } from '@angular/common'
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core'
import { AiService } from '../ai/ai.service'
import { parseJsonFromModelResponse } from '../ai/json-response'
import { ConfigStore } from '../core/config.store'
import { Bookmarks } from '../core/storage-data'
import { StorageService } from '../core/storage.service'
import { emptyPageContext } from '../page/page-context.model'
import { PageContextService } from '../page/page-context.service'
import {
  addBookmark,
  applyMerges,
  buildCategorizationPrompt,
  buildReorganizationPrompt,
  chunkBookmarks,
  normalizeMerges
} from './bookmark-merge'

const CHUNK_MAX_BYTES = 45_000
const REORGANIZE_EVERY = 5

/** Saves every visited page into a category picked by the model. */
@Injectable()
export class BookmarkService {
  readonly #storage = inject(StorageService)
  readonly #page = inject(PageContextService)
  readonly #ai = inject(AiService)
  readonly #configStore = inject(ConfigStore)
  readonly #document = inject(DOCUMENT)

  readonly bookmarks = signal<Bookmarks>({})
  readonly aiBookmarksEnabled = signal(true)
  readonly isActive = computed(
    () =>
      this.#configStore.features().bookmarks &&
      this.aiBookmarksEnabled() &&
      this.#ai.isModelReady()
  )
  #lastUrl = ''

  constructor() {
    const view = this.#document.defaultView
    const onNavigate = (): void => this.#categorize()
    const navigation = (view as { navigation?: EventTarget } | null)?.navigation
    if (navigation) {
      navigation.addEventListener('navigatesuccess', onNavigate)
    } else {
      view?.addEventListener('popstate', onNavigate)
      view?.addEventListener('hashchange', onNavigate)
    }

    inject(DestroyRef).onDestroy(() => {
      navigation?.removeEventListener('navigatesuccess', onNavigate)
      view?.removeEventListener('popstate', onNavigate)
      view?.removeEventListener('hashchange', onNavigate)
    })

    effect(() => {
      if (this.isActive()) untracked(() => this.#categorize())
    })
  }

  async init(): Promise<void> {
    await this.refresh()
  }

  async refresh(): Promise<void> {
    const data = await this.#storage.load()
    this.bookmarks.set(data.bookmarks.bookmarksData)
    this.aiBookmarksEnabled.set(data.bookmarks.aiBookmarksEnabled)
  }

  setEnabled(enabled: boolean): void {
    this.aiBookmarksEnabled.set(enabled)
    void this.#storage.setAiBookmarksEnabled(enabled)
  }

  deleteCategory(category: string): void {
    const { [category]: _removed, ...rest } = this.bookmarks()
    this.#save(rest)
  }

  deleteBookmark(category: string, url: string): void {
    const current = this.bookmarks()
    const entries = (current[category] ?? []).filter(
      (entry) => entry.url !== url
    )
    const { [category]: _removed, ...rest } = current
    this.#save(entries.length ? { ...current, [category]: entries } : rest)
  }

  clearAll(): void {
    this.#save({})
  }

  async reorganize(): Promise<void> {
    const bookmarks = await this.#storage.loadBookmarks()
    if (Object.keys(bookmarks).length < 2) return

    const answers = await Promise.all(
      chunkBookmarks(bookmarks, CHUNK_MAX_BYTES).map((chunk) =>
        this.#ai.prompt({
          userPrompt: buildReorganizationPrompt(chunk),
          agentMode: true,
          track: false
        })
      )
    )
    const merges = normalizeMerges(
      {
        merges: answers.flatMap((answer) => {
          const parsed = parseJsonFromModelResponse(answer) as {
            merges?: unknown
          } | null
          return Array.isArray(parsed?.merges) ? parsed.merges : []
        })
      },
      bookmarks
    )
    if (merges.length > 0) this.#save(applyMerges(bookmarks, merges))
  }

  #save(bookmarks: Bookmarks): void {
    this.bookmarks.set(bookmarks)
    void this.#storage.setBookmarks(bookmarks)
  }

  #categorize(): void {
    const url = this.#document.location?.href ?? ''
    if (!this.isActive() || !url || url === this.#lastUrl) return
    this.#lastUrl = url
    void this.#categorizePage(url).catch(() => undefined)
  }

  async #categorizePage(url: string): Promise<void> {
    const page = this.#page.extractPageContext()
    if (page.url !== url) return

    const categories = Object.keys(await this.#storage.loadBookmarks())
    const { content } = await this.#ai.promptWithQuotaRetry({
      userPrompt: buildCategorizationPrompt(categories),
      page: { ...emptyPageContext(), ...page },
      includePageContext: true,
      track: false,
      reductionStep: 10
    })

    const parsed = parseJsonFromModelResponse(content) as {
      category?: unknown
    } | null
    const category = String(parsed?.category ?? '').trim()
    if (!category) return

    // Read again: other tabs may have saved bookmarks during the AI call.
    const latest = await this.#storage.loadBookmarks()
    const next = addBookmark(latest, category, {
      title: page.title || this.#configStore.strings().untitledPage,
      url: page.url
    })
    if (!next) return

    this.#save(next)
    if (await this.#storage.trackBookmarkAddition(REORGANIZE_EVERY)) {
      await this.reorganize()
    }
  }
}
