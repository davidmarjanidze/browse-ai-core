import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core'
import {
  AiContentPart,
  AiPromptInput,
  AiProvider,
  AiSession,
  AiSessionOptions,
  getAiAvailability,
  getSessionOptions
} from 'browse-ai-core'
import { ConfigStore } from '../core/config.store'
import { StorageService } from '../core/storage.service'
import { PageContextInfo, emptyPageContext } from '../page/page-context.model'
import { buildPrompt } from './prompt-builder'
import { RequestStatus } from './request-status'
import {
  GenerationStoppedError,
  isQuotaExceededError,
  readResponse
} from './stream-reader'

export interface ContextUsage {
  used: number
  total: number
  percentage: number
}

export interface PromptOptions {
  userPrompt: string
  page?: Partial<PageContextInfo>
  includePageContext?: boolean
  /** Send `userPrompt` as it is (used by tools). */
  agentMode?: boolean
  /** Data URL, or the image itself. */
  imageData?: string | Blob
  audioData?: string
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  /** Create the session with image input (non-shared sessions only). */
  withImageInput?: boolean
  /** Use the conversation session, so the model remembers earlier turns. */
  useSharedSession?: boolean
  personalize?: boolean
  /** Update the generating/thinking status shown in the UI. */
  track?: boolean
  showThinking?: boolean
}

export interface RetryOptions extends PromptOptions {
  page: PageContextInfo
  /** Percent of page text removed on each retry after a quota error. */
  reductionStep?: number
  maxReductionPercent?: number
}

const EMPTY_USAGE: ContextUsage = { used: 0, total: 0, percentage: 0 }

/** Talks to the configured AI provider and tracks model state for the UI. */
@Injectable()
export class AiService {
  readonly #configStore = inject(ConfigStore)
  readonly #storage = inject(StorageService)
  readonly #status = new RequestStatus()
  readonly #provider = computed(() => this.#configStore.config().aiProvider)

  readonly isChecking = signal(true)
  readonly isSupported = signal(false)
  readonly isModelReady = signal(false)
  /** The model accepts image input (checked separately from text). */
  readonly supportsImageInput = signal(false)
  readonly isDownloading = signal(false)
  readonly downloadProgress = signal(0)
  readonly errorMessage = signal<string | null>(null)
  readonly contextUsage = signal<ContextUsage>(EMPTY_USAGE)
  readonly isGenerating = this.#status.isGenerating
  readonly isAwaitingFirstChunk = this.#status.isAwaitingFirstChunk
  readonly isThinking = this.#status.isThinking
  readonly providerName = computed(() => this.#provider().name)
  readonly downloadSize = computed(() => this.#provider().downloadSize)

  #session: AiSession | null = null

  constructor() {
    effect(() => {
      const provider = this.#provider()
      untracked(() => {
        this.resetSession()
        void this.#checkAvailability(provider)
        void this.#checkImageInput(provider)
      })
    })
  }

  get #strings() {
    return this.#configStore.strings()
  }

  #withImage(options: AiSessionOptions): AiSessionOptions {
    const inputs = options.expectedInputs ?? ['text']
    return inputs.includes('image')
      ? options
      : { ...options, expectedInputs: [...inputs, 'image'] }
  }

  async #checkImageInput(provider: AiProvider): Promise<void> {
    try {
      const availability = await provider.availability(
        this.#withImage(this.#sessionOptions())
      )
      this.supportsImageInput.set(availability !== 'unavailable')
    } catch {
      this.supportsImageInput.set(false)
    }
  }

  #sessionOptions(): AiSessionOptions {
    return getSessionOptions(this.#configStore.config())
  }

  async #checkAvailability(provider: AiProvider): Promise<void> {
    this.isChecking.set(true)
    this.errorMessage.set(null)

    const availability = await getAiAvailability({
      ...this.#configStore.config(),
      aiProvider: provider
    })
    this.isSupported.set(availability !== 'unavailable')
    this.isModelReady.set(availability === 'available')
    if (availability === 'unavailable') {
      this.errorMessage.set(this.#strings.notSupported)
    }
    this.isChecking.set(false)
  }

  async downloadModel(): Promise<void> {
    if (this.isDownloading()) return

    this.isDownloading.set(true)
    this.downloadProgress.set(0)
    this.errorMessage.set(null)

    try {
      this.#session = await this.#provider().createSession({
        ...this.#sessionOptions(),
        onDownloadProgress: (loaded) =>
          this.downloadProgress.set(Math.round(loaded * 100))
      })
      this.downloadProgress.set(100)
      this.isModelReady.set(true)
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : this.#strings.responseFailed
      )
    } finally {
      this.isDownloading.set(false)
    }
  }

  async prompt(options: PromptOptions): Promise<string> {
    const {
      userPrompt,
      page,
      includePageContext = false,
      agentMode = false,
      imageData,
      audioData,
      signal,
      onChunk,
      useSharedSession = false,
      withImageInput = false,
      personalize = false,
      track = true,
      showThinking = false
    } = options

    if (!this.isModelReady()) throw new Error(this.#strings.modelNotReady)

    const request = track ? this.#status.begin(showThinking) : null
    let session: AiSession | null = null

    try {
      session = useSharedSession
        ? await this.#getSharedSession()
        : await this.#provider().createSession(
            withImageInput
              ? this.#withImage(this.#sessionOptions())
              : this.#sessionOptions()
          )

      const text = buildPrompt({
        userPrompt,
        page: { ...emptyPageContext(), ...page },
        includePageContext,
        agentMode,
        personalization: personalize
          ? await this.#storage.loadPersonalization()
          : undefined,
        hasImage: Boolean(imageData),
        hasAudio: Boolean(audioData)
      })
      const input = await this.#buildInput(text, imageData, audioData)

      return await readResponse(session, input, signal, (chunk) => {
        if (request) this.#status.firstChunk(request)
        onChunk?.(chunk)
      })
    } finally {
      if (track && useSharedSession) this.#updateContextUsage(session)
      if (!useSharedSession) session?.destroy?.()
      if (request) this.#status.end(request)
    }
  }

  /**
   * Like `prompt`, but when the model says the input is too large it cuts
   * the page text by `reductionStep` percent and tries again.
   */
  async promptWithQuotaRetry(
    options: RetryOptions
  ): Promise<{ content: string; reductionPercent: number }> {
    const { page, reductionStep = 5, maxReductionPercent = 100 } = options
    const canReduce =
      options.includePageContext || Boolean(page.selectedText?.trim())

    for (
      let reductionPercent = 0;
      reductionPercent <= maxReductionPercent;
      reductionPercent += reductionStep
    ) {
      if (options.signal?.aborted) {
        throw new GenerationStoppedError(this.#strings.generationStopped)
      }

      const keep = Math.floor(
        page.mainText.length * ((100 - reductionPercent) / 100)
      )

      try {
        const content = await this.prompt({
          ...options,
          page: { ...page, mainText: page.mainText.slice(0, keep) }
        })
        return { content, reductionPercent }
      } catch (error) {
        const retry =
          isQuotaExceededError(error) &&
          canReduce &&
          reductionPercent < maxReductionPercent
        if (!retry) throw error
      }
    }

    throw new Error(this.#strings.inputTooLarge)
  }

  resetSession(): void {
    this.#session?.destroy?.()
    this.#session = null
    this.contextUsage.set(EMPTY_USAGE)
  }

  async #getSharedSession(): Promise<AiSession> {
    this.#session ??= await this.#provider().createSession(
      this.#sessionOptions()
    )
    return this.#session
  }

  async #buildInput(
    text: string,
    imageData?: string | Blob,
    audioData?: string
  ): Promise<AiPromptInput> {
    if (!imageData && !audioData) return text

    const content: AiContentPart[] = [{ type: 'text', value: text }]
    if (imageData) {
      content.push({
        type: 'image',
        value:
          typeof imageData === 'string'
            ? await (await fetch(imageData)).blob()
            : imageData
      })
    }
    if (audioData) {
      content.push({
        type: 'audio',
        value: await (await fetch(audioData)).blob()
      })
    }
    return [{ role: 'user', content }]
  }

  #updateContextUsage(session: AiSession | null): void {
    // Older Chrome versions call these inputUsage and inputQuota.
    const legacy = session as {
      inputUsage?: number
      inputQuota?: number
    } | null
    const used = session?.contextUsage ?? legacy?.inputUsage
    const total = session?.contextWindow ?? legacy?.inputQuota
    if (used === undefined || total === undefined || total === 0) return

    this.contextUsage.set({
      used,
      total,
      percentage: Math.min(100, Math.round((used / total) * 100))
    })
  }
}
