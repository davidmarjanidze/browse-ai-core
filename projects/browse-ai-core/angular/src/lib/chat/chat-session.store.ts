import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked
} from '@angular/core'
import { AiService } from '../ai/ai.service'
import {
  BuiltInAiService,
  isBuiltInTool
} from '../ai/built-in/built-in-ai.service'
import { isGenerationStopped } from '../ai/stream-reader'
import { ConfigStore } from '../core/config.store'
import { ToastService } from '../core/toast.service'
import { PageContextService } from '../page/page-context.service'
import { SNIP_CANCELED } from '../page/region-selector'
import { SnipCaptureService } from '../page/snip-capture.service'
import {
  DomElementSelection,
  DomInspectorService
} from '../tools/dom-to-component/dom-inspector.service'
import {
  DOM_COMPONENT_FRAMEWORKS,
  DomToComponentFramework,
  ToolId,
  getTools
} from '../tools/tools.model'
import { ChatEvents } from './chat-events'
import { ChatMessage, ContextMode } from './chat.model'
import {
  StreamState,
  appendChunk,
  completeAnswer,
  createUserMessage,
  failAnswer
} from './chat-messages'
import { ToolRunner } from './tool-runner'

export type ScrollRequest =
  { target: 'bottom' } | { target: 'message'; id: string }

/** State and actions of one conversation. Components read it directly. */
@Injectable()
export class ChatSessionStore {
  readonly ai = inject(AiService)
  readonly builtIn = inject(BuiltInAiService)
  readonly #configStore = inject(ConfigStore)
  readonly #page = inject(PageContextService)
  readonly #snip = inject(SnipCaptureService)
  readonly #inspector = inject(DomInspectorService)
  readonly #tools = inject(ToolRunner)
  readonly #toast = inject(ToastService)
  readonly #events = inject(ChatEvents)

  readonly messages = signal<ChatMessage[]>([])
  readonly prompt = signal('')
  readonly #defaultContextMode = computed(
    () => this.#configStore.config().defaultContextMode
  )
  /** Starts at `defaultContextMode`; the user's choice wins until it changes. */
  readonly contextMode = linkedSignal<ContextMode>(() =>
    this.#defaultContextMode()
  )
  readonly pageContentReduction = signal(0)
  readonly image = signal<string | null>(null)
  readonly audio = signal<string | null>(null)
  readonly selectedTool = signal<ToolId | null>(null)
  readonly domFramework = signal<DomToComponentFramework>(
    DOM_COMPONENT_FRAMEWORKS.Angular
  )
  readonly domSelection = signal<DomElementSelection | null>(null)
  readonly isToolRunning = signal(false)
  readonly scrollRequest = signal<ScrollRequest | null>(null)
  readonly context = this.#page.currentContext
  readonly hoveredElementLabel = this.#inspector.hoveredLabel
  readonly isInspecting = this.#inspector.isInspecting
  readonly formSuggestionCount = this.#tools.formSuggestionCount
  readonly extractedTables = this.#tools.extractedTables
  readonly matchedImages = this.#tools.matchedImages

  readonly strings = this.#configStore.strings
  readonly features = this.#configStore.features
  readonly tools = computed(() => {
    const states = this.builtIn.states()
    return getTools(
      this.features(),
      this.strings(),
      (tool) => {
        if (!this.builtIn.exists(tool)) return false
        const availability = states[tool].availability
        return tool === 'translator'
          ? true
          : availability !== null && availability !== 'unavailable'
      },
      this.ai.supportsImageInput()
    )
  })
  readonly selectedToolInfo = computed(
    () => this.tools().find((tool) => tool.id === this.selectedTool()) ?? null
  )
  readonly usesPageContext = computed(
    () => this.features().pageContext && this.contextMode() === 'page'
  )
  /** A response or tool is running. Only Stop is enabled. */
  readonly isBusy = computed(
    () => this.ai.isGenerating() || this.isToolRunning()
  )
  /** The selected built-in AI tool whose model must be downloaded first. */
  readonly toolNeedingDownload = computed(() => {
    const tool = this.selectedTool()
    if (!isBuiltInTool(tool)) return null
    this.builtIn.states()
    return this.builtIn.isReady(tool) ? null : tool
  })
  readonly canSend = computed(() => {
    const tool = this.selectedTool()
    if (this.isBusy()) return false
    if (isBuiltInTool(tool)) {
      return this.builtIn.isReady(tool) && Boolean(this.prompt().trim())
    }
    if (!this.ai.isModelReady()) return false
    if (this.selectedTool() === 'dom-to-component')
      return this.domSelection() !== null
    if (this.selectedTool() === 'dictation') return Boolean(this.audio())
    return Boolean(
      this.prompt().trim() ||
      this.image() ||
      this.audio() ||
      this.selectedToolInfo()?.promptOptional
    )
  })

  #requestId = 0
  #abort: AbortController | null = null

  constructor() {
    effect(() => {
      const inspect =
        this.selectedTool() === 'dom-to-component' && !this.domSelection()
      untracked(() =>
        inspect ? this.#startInspector() : this.#inspector.stop()
      )
    })
    inject(DestroyRef).onDestroy(() => {
      this.#abort?.abort()
      this.#inspector.stop()
    })
  }

  init(): void {
    this.#page.extractPageContext()
  }

  onComposerFocus(): void {
    this.#page.applySelectionHighlight()
  }

  clear(): void {
    this.#requestId += 1
    this.#abort?.abort()
    this.isToolRunning.set(false)
    this.messages.set([])
    this.prompt.set('')
    this.contextMode.set(this.#defaultContextMode())
    this.image.set(null)
    this.audio.set(null)
    this.pageContentReduction.set(0)
    this.domSelection.set(null)
    this.#tools.reset()
    this.#page.clearSelection()
    this.#page.extractPageContext()
    this.ai.resetSession()
  }

  stop(): void {
    this.#abort?.abort()
  }

  selectTool(tool: ToolId | null): void {
    this.domSelection.set(null)
    this.selectedTool.set(tool)
  }

  /**
   * Runs a tool on `text` the same way as picking the tool, typing the text
   * and pressing Send. Used by the selection actions.
   */
  async runTool(tool: ToolId, text: string): Promise<void> {
    if (this.isBusy()) return
    this.selectTool(tool)
    this.prompt.set(text)
    this.#page.clearSelection()
    await this.send()
  }

  attachFile(file: File, kind: 'image' | 'audio'): void {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') this[kind].set(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async capture(kind: 'visible' | 'region'): Promise<void> {
    if (this.ai.isGenerating()) return
    try {
      if (kind === 'region') this.#toast.show(this.strings().snipStarted)
      const image =
        kind === 'region'
          ? await this.#snip.captureRegion()
          : await this.#snip.captureVisibleArea()
      this.image.set(image)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message !== SNIP_CANCELED)
        this.#toast.error(message || this.strings().captureFailed)
    }
  }

  async send(): Promise<void> {
    if (!this.canSend()) return

    const text = this.prompt().trim()
    const image = this.image() ?? undefined
    const audio = this.audio() ?? undefined
    const tool = this.selectedTool()
    const selection = this.domSelection()
    const strings = this.strings()

    const shown = selection
      ? `${strings.domToComponentName}: <${selection.tagName}> (${this.domFramework()})${text ? `\n${text}` : ''}`
      : text
    const userMessage = createUserMessage(shown, image, audio)
    this.messages.update((messages) => [...messages, userMessage])
    this.scrollRequest.set({ target: 'message', id: userMessage.id })
    this.#events.messageSent.next({
      text,
      hasImage: !!image,
      hasAudio: !!audio
    })

    const isFirstPrompt = this.messages().length === 1
    const page = this.#page.extractPageContext()
    const requestId = ++this.#requestId
    const abort = (this.#abort = new AbortController())
    const state: StreamState = { content: '', messageAdded: false }
    const isCurrent = (): boolean => requestId === this.#requestId

    this.prompt.set('')
    this.image.set(null)
    this.audio.set(null)
    this.pageContentReduction.set(0)

    try {
      if (tool) {
        this.isToolRunning.set(true)
        const result = await this.#tools.run(tool, {
          text,
          selection,
          framework: this.domFramework(),
          audio,
          signal: abort.signal,
          onChunk: (chunk) => this.#onChunk(chunk, state, isCurrent),
          onStatus: (status) => {
            state.content = ''
            this.#onChunk(status, state, isCurrent)
          }
        })
        if (!isCurrent()) return
        this.messages.update((messages) =>
          completeAnswer(messages, state, result.content, result.extra)
        )
        this.#events.responseReceived.next({ text: result.content })
        if (tool === 'dom-to-component') this.selectTool(null)
      } else {
        const result = await this.ai.promptWithQuotaRetry({
          userPrompt: text,
          page,
          includePageContext: this.usesPageContext(),
          imageData: image,
          audioData: audio,
          signal: abort.signal,
          useSharedSession: true,
          personalize: this.features().personalization,
          showThinking: isFirstPrompt,
          onChunk: (chunk) => this.#onChunk(chunk, state, isCurrent)
        })
        if (!isCurrent()) return
        this.pageContentReduction.set(result.reductionPercent)
        this.messages.update((messages) =>
          completeAnswer(messages, state, result.content)
        )
        this.#events.responseReceived.next({ text: result.content })
      }
    } catch (error) {
      if (!isCurrent()) return
      const stopped = isGenerationStopped(error) || abort.signal.aborted
      const message = stopped
        ? strings.generationStopped
        : error instanceof Error
          ? error.message
          : strings.responseFailed
      this.messages.update((messages) =>
        failAnswer(messages, state, message, stopped)
      )
      if (!stopped) {
        this.#events.errorOccurred.next(
          error instanceof Error ? error : new Error(message)
        )
      }
    } finally {
      if (isCurrent()) {
        this.isToolRunning.set(false)
        if (tool && tool !== 'dom-to-component') this.selectedTool.set(null)
      }
    }
  }

  acceptAllSuggestions(): void {
    this.#tools.acceptAllSuggestions()
  }

  dismissAllSuggestions(): void {
    this.#tools.dismissAllSuggestions()
  }

  downloadImages(): void {
    void this.#tools.downloadImages()
  }

  downloadTables(format: Parameters<ToolRunner['downloadTables']>[0]): void {
    this.#tools.downloadTables(format)
  }

  #onChunk(chunk: string, state: StreamState, isCurrent: () => boolean): void {
    if (!isCurrent()) return
    this.messages.update((messages) => appendChunk(messages, state, chunk))
    this.scrollRequest.set({ target: 'bottom' })
  }

  #startInspector(): void {
    this.#toast.show(this.strings().inspectorActive)
    this.#inspector.start({
      onSelected: (selection) => {
        this.domSelection.set(selection)
        this.#toast.success(this.strings().elementAttached)
      },
      onCanceled: () => this.selectTool(null)
    })
  }
}
