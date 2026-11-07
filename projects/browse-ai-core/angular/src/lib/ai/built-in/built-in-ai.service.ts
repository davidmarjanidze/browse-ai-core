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
import {
  AiAvailability,
  BUILT_IN_TOOL_IDS,
  BuiltInToolId,
  DEFAULT_BUILT_IN_TOOLS,
  formatString
} from 'browse-ai-core'
import { ConfigStore } from '../../core/config.store'
import {
  API_GLOBALS,
  TaskApiInstance,
  detectLanguage,
  downloadMonitor,
  fitsInputQuota,
  getFactory,
  runTaskApi
} from './built-in-apis'

export interface BuiltInToolState {
  /** `null` while checking or when the API is missing. */
  availability: AiAvailability | null
  isDownloading: boolean
  progress: number
  error: string | null
}

const INITIAL: BuiltInToolState = {
  availability: null,
  isDownloading: false,
  progress: 0,
  error: null
}

export function isBuiltInTool(tool: string | null): tool is BuiltInToolId {
  return BUILT_IN_TOOL_IDS.includes(tool as BuiltInToolId)
}

/** Chrome's Summarizer, Translator, Writer, Rewriter and Proofreader APIs. */
@Injectable()
export class BuiltInAiService {
  readonly #configStore = inject(ConfigStore)
  readonly #instances = new Map<string, TaskApiInstance>()
  readonly #checks = new Map<BuiltInToolId, number>()

  readonly states = signal<Record<BuiltInToolId, BuiltInToolState>>(
    Object.fromEntries(BUILT_IN_TOOL_IDS.map((id) => [id, INITIAL])) as Record<
      BuiltInToolId,
      BuiltInToolState
    >
  )

  readonly #options = computed(() => {
    const { ai } = this.#configStore.config()
    const custom = ai.builtInTools ?? {}
    const merged = Object.fromEntries(
      BUILT_IN_TOOL_IDS.map((id) => [
        id,
        { ...DEFAULT_BUILT_IN_TOOLS[id], ...custom[id] }
      ])
    ) as {
      [K in BuiltInToolId]: (typeof DEFAULT_BUILT_IN_TOOLS)[K] &
        NonNullable<(typeof custom)[K]>
    }
    return { ...merged, outputLanguage: ai.outputLanguage }
  })

  /** Language picked in the Translator select. */
  readonly targetLanguage = linkedSignal(
    () =>
      this.#options().translator.targetLanguage ??
      this.#options().outputLanguage
  )

  constructor() {
    effect(() => {
      this.#options()
      this.targetLanguage()
      untracked(() => {
        this.#destroyInstances()
        for (const id of BUILT_IN_TOOL_IDS) void this.refresh(id)
      })
    })
    inject(DestroyRef).onDestroy(() => this.#destroyInstances())
  }

  /** The API exists in this browser. */
  exists(tool: BuiltInToolId): boolean {
    return getFactory(API_GLOBALS[tool]) !== null
  }

  isReady(tool: BuiltInToolId): boolean {
    const state = this.states()[tool]
    return state.availability === 'available' && !state.isDownloading
  }

  async refresh(tool: BuiltInToolId): Promise<void> {
    const check = (this.#checks.get(tool) ?? 0) + 1
    this.#checks.set(tool, check)
    const factory = getFactory(API_GLOBALS[tool])
    let availability: AiAvailability | null = null
    if (factory && tool === 'translator' && this.#isSameLanguage('en')) {
      availability = 'available'
    } else if (factory) {
      try {
        availability = await factory.availability(
          this.#createOptions(tool, 'en')
        )
      } catch {
        availability = 'unavailable'
      }
    }
    // A newer check started meanwhile (e.g. the language changed): drop this one.
    if (this.#checks.get(tool) === check) this.#patch(tool, { availability })
  }

  async download(tool: BuiltInToolId): Promise<void> {
    if (this.states()[tool].isDownloading) return
    try {
      await this.#instance(tool, 'en')
      this.#patch(tool, { availability: 'available' })
    } catch (error) {
      this.#patch(tool, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  async run(
    tool: BuiltInToolId,
    text: string,
    signal: AbortSignal,
    onChunk: (chunk: string) => void,
    /** Options for this call only, on top of `builtInTools`. */
    overrides: object = {}
  ): Promise<string> {
    const strings = this.#configStore.strings()
    let source = 'en'
    if (tool === 'translator') {
      source =
        this.#options().translator.sourceLanguage ??
        (await detectLanguage(text, 'en'))
      if (this.#isSameLanguage(source)) {
        onChunk(text)
        return text
      }
    }
    if (!getFactory(API_GLOBALS[tool])) {
      throw new Error(
        formatString(strings.toolUnavailable, { tool: API_GLOBALS[tool] })
      )
    }

    const instance = await this.#instance(tool, source, signal, overrides)
    if (!(await fitsInputQuota(instance, text))) {
      throw new Error(strings.textTooLong)
    }
    return runTaskApi(tool, instance, text, signal, onChunk)
  }

  #isSameLanguage(source: string): boolean {
    const base = (code: string) => code.toLowerCase().split('-')[0]
    return base(source) === base(this.targetLanguage())
  }

  #createOptions(
    tool: BuiltInToolId,
    source: string,
    overrides: object = {}
  ): object {
    return { ...this.#baseOptions(tool, source), ...overrides }
  }

  #baseOptions(tool: BuiltInToolId, source: string): object {
    const options = this.#options()
    const outputLanguage = options.outputLanguage
    switch (tool) {
      case 'translator':
        return { sourceLanguage: source, targetLanguage: this.targetLanguage() }
      case 'proofreader':
        return { ...options.proofreader }
      default:
        return { ...options[tool], outputLanguage }
    }
  }

  async #instance(
    tool: BuiltInToolId,
    source: string,
    signal?: AbortSignal,
    overrides: object = {}
  ): Promise<TaskApiInstance> {
    const options = this.#createOptions(tool, source, overrides)
    const key = `${tool}:${JSON.stringify(options)}`
    const cached = this.#instances.get(key)
    if (cached) return cached

    const factory = getFactory(API_GLOBALS[tool])
    if (!factory) throw new Error(API_GLOBALS[tool])
    this.#patch(tool, { isDownloading: true, progress: 0, error: null })
    try {
      const instance = await factory.create({
        ...options,
        signal,
        monitor: downloadMonitor((loaded) =>
          this.#patch(tool, { progress: Math.round(loaded * 100) })
        )
      })
      this.#instances.set(key, instance)
      return instance
    } finally {
      this.#patch(tool, { isDownloading: false })
    }
  }

  #patch(tool: BuiltInToolId, patch: Partial<BuiltInToolState>): void {
    this.states.update((states) => ({
      ...states,
      [tool]: { ...states[tool], ...patch }
    }))
  }

  #destroyInstances(): void {
    for (const instance of this.#instances.values()) instance.destroy?.()
    this.#instances.clear()
  }
}
