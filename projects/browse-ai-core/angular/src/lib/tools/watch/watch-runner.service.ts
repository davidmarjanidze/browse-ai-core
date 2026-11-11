import { DOCUMENT } from '@angular/common'
import {
  DestroyRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core'
import { AiSession, formatString, getSessionOptions } from 'browse-ai-core'
import {
  isSessionNearlyFull,
  promptWithSchema
} from '../../ai/constrained-prompt'
import { ChatEvents } from '../../chat/chat-events'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ToolNotices } from '../../chat/tool-notices'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { PanelStore } from '../../core/panel.store'
import { ToastService } from '../../core/toast.service'
import { isSensitiveField } from '../../page/insert-text'
import { MarkerLayer } from '../../page/marker-layer'
import { flashElement } from '../agent/agent-screen'
import {
  DomInspectorService,
  describeElement
} from '../dom-to-component/dom-inspector.service'
import { ElementLocator, createLocator, findByLocator } from './element-locator'
import {
  WATCH_SCHEMA,
  WATCH_SYSTEM_PROMPT,
  buildWatchPrompt,
  parseWatchVerdict
} from './watch-prompt'
import { MAX_WATCHED_CHARS, capText, readWatchedText } from './watched-text'

/** Failed checks or missing-element checks in a row before the chat says so. */
export const FAILS_BEFORE_NOTICE = 3
/** Texts kept from DOM changes between two checks. */
const MAX_SEEN = 5
const PREVIEW_CHARS = 120
/** Shortest time between two text reads from DOM changes, in ms. */
const SEEN_THROTTLE_MS = 250

export interface WatchPick {
  element: HTMLElement
  label: string
  preview: string
  tooLong: boolean
}

export interface WatchStatus {
  label: string
  instruction: string
  checks: number
  matches: number
}

/** Watch Mode: checks a picked element's text on a timer and asks the model if the change is the one the user wants. */
@Injectable()
export class WatchRunnerService {
  readonly #config = inject(ConfigStore)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #notices = inject(ToolNotices)
  readonly #events = inject(ChatEvents)
  readonly #panel = inject(PanelStore)
  readonly #toast = inject(ToastService)
  readonly #inspector = inject(DomInspectorService)

  readonly picked = signal<WatchPick | null>(null)
  readonly isPicking = signal(false)
  readonly status = signal<WatchStatus | null>(null)
  /** A change was found while the panel was closed. */
  readonly unread = signal(false)

  #element: Element | null = null
  #locator: ElementLocator | null = null
  #instruction = ''
  #baseline = ''
  #previous = ''
  #lastReported = ''
  #seen: string[] = []
  #missing = 0
  #failures = 0
  #busy = false
  #lastSeenAt = 0
  #timer: ReturnType<typeof setInterval> | null = null
  #observer: MutationObserver | null = null
  #abort: AbortController | null = null
  #session: AiSession | null = null
  #layer: MarkerLayer | null = null

  constructor() {
    effect(() => {
      if (this.#panel.isOpen()) untracked(() => this.unread.set(false))
    })
    inject(DestroyRef).onDestroy(() => this.stop(false))
  }

  /** Starts the element picker. */
  pick(): void {
    this.isPicking.set(true)
    this.#toast.show(this.#config.strings().watchPicking)
    this.#inspector.start({
      accept: (element) => !isSensitiveField(element),
      onSelected: (selection) => {
        this.isPicking.set(false)
        if (selection.element) this.#setPick(selection.element)
      },
      onCanceled: () => this.isPicking.set(false)
    })
  }

  cancelPick(): void {
    if (this.isPicking()) this.#inspector.stop()
    this.isPicking.set(false)
  }

  clearPick(): void {
    this.cancelPick()
    this.picked.set(null)
  }

  #setPick(element: HTMLElement): void {
    const text = readWatchedText(element)
    if (!text) {
      this.#toast.error(this.#config.strings().watchNoText)
      return
    }
    this.picked.set({
      element,
      label: describeElement(element),
      preview:
        text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text,
      tooLong: text.length > MAX_WATCHED_CHARS
    })
  }

  /** Starts watching the picked element. Returns right away; checks run on a timer. */
  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#config.strings()
    const pick = this.picked()
    if (!pick) return { content: strings.watchNoElement }
    this.stop(false)

    const element = pick.element.isConnected
      ? pick.element
      : findByLocator(this.#document, createLocator(pick.element))
    if (!element) return { content: strings.watchElementGone }
    this.#locator = createLocator(element)
    this.#instruction = request.text
    this.#baseline = this.#previous = capText(readWatchedText(element))
    this.#lastReported = ''
    this.#seen = []
    this.#missing = this.#failures = 0
    this.#abort = new AbortController()
    this.#attach(element)
    this.status.set({
      label: pick.label,
      instruction: request.text,
      checks: 0,
      matches: 0
    })
    this.picked.set(null)
    this.#timer = setInterval(
      () => void this.check(),
      this.#config.config().watch.intervalMs
    )

    const started = formatString(strings.watchStarted, {
      element: pick.label,
      instruction: request.text
    })
    return {
      content: pick.tooLong
        ? `${started}\n\n${formatString(strings.watchTooLong, { count: MAX_WATCHED_CHARS })}`
        : started
    }
  }

  /** Ends the watch. `announce` posts the summary in the chat. */
  stop(announce = true): void {
    const status = this.status()
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = null
    this.#observer?.disconnect()
    this.#observer = null
    this.#abort?.abort()
    this.#abort = null
    this.#session?.destroy?.()
    this.#session = null
    this.#layer?.destroy()
    this.#layer = null
    this.#element = null
    this.#busy = false
    this.status.set(null)
    this.unread.set(false)
    if (announce && status) {
      this.#notices.post(
        formatString(this.#config.strings().watchStopped, {
          checks: status.checks,
          matches: status.matches
        })
      )
    }
  }

  /** One check. Runs on the timer; public for tests. */
  async check(): Promise<void> {
    if (this.#busy || !this.status() || !this.#abort) return
    this.#busy = true
    const signal = this.#abort.signal
    const strings = this.#config.strings()
    try {
      const element = this.#resolve()
      if (!element) return
      const current = capText(readWatchedText(element))
      this.#count('checks')
      const seen = this.#seen.filter(
        (text) => text !== current && text !== this.#previous
      )
      if (current === this.#previous && seen.length === 0) return

      const answer = await this.#ask(current, seen, signal)
      if (signal.aborted) return
      const verdict = parseWatchVerdict(answer)
      if (!verdict) throw new Error('The model did not answer with JSON.')
      this.#failures = 0
      const threshold = this.#config.config().watch.threshold
      if (
        verdict.matches &&
        verdict.confidence >= threshold &&
        current !== this.#lastReported
      ) {
        this.#report(element, current, verdict.message, verdict.confidence)
      }
      this.#previous = current
      this.#seen = []
    } catch (error) {
      if (signal.aborted) return
      if (++this.#failures === FAILS_BEFORE_NOTICE) {
        this.#notices.post(
          formatString(strings.watchCheckFailed, {
            error: error instanceof Error ? error.message : String(error)
          }),
          true
        )
      }
    } finally {
      if (!signal.aborted) this.#busy = false
    }
  }

  #report(
    element: Element,
    current: string,
    message: string,
    confidence: number
  ): void {
    const strings = this.#config.strings()
    const time = new Date().toLocaleTimeString()
    const short = (text: string): string =>
      text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text
    this.#notices.post(
      [
        formatString(strings.watchMatched, {
          time,
          message: message || this.#instruction
        }),
        formatString(strings.watchWas, { text: short(this.#previous) }),
        formatString(strings.watchNow, { text: short(current) })
      ].join('\n\n')
    )
    this.#events.watchMatched.next({
      instruction: this.#instruction,
      previous: this.#previous,
      current,
      message,
      confidence
    })
    this.#lastReported = current
    this.#count('matches')
    if (!this.#panel.isOpen()) this.unread.set(true)
    flashElement(
      this.#document,
      element,
      getComputedStyle(this.#host).getPropertyValue('--bac-primary').trim() ||
        '#2563eb',
      1500
    )
  }

  async #ask(
    current: string,
    seen: string[],
    signal: AbortSignal
  ): Promise<string> {
    const config = this.#config.config()
    if (this.#session && isSessionNearlyFull(this.#session)) {
      this.#session.destroy?.()
      this.#session = null
    }
    this.#session ??= await config.aiProvider.createSession({
      ...getSessionOptions(config),
      systemPrompt: WATCH_SYSTEM_PROMPT,
      initialPrompts: undefined,
      expectedInputs: ['text']
    })
    const prompt = buildWatchPrompt({
      instruction: this.#instruction,
      baseline: this.#baseline,
      previous: this.#previous,
      current,
      lang: this.#document.documentElement.lang || undefined
    })
    const extra = seen.length
      ? `\nOTHER TEXTS SEEN BETWEEN THE CHECKS:\n${seen.map((text) => `* ${text.slice(0, 300)}`).join('\n')}`
      : ''
    return promptWithSchema(this.#session, prompt + extra, WATCH_SCHEMA, signal)
  }

  /** The watched element, found again after a re-render, or null. */
  #resolve(): Element | null {
    const strings = this.#config.strings()
    if (this.#element?.isConnected) return this.#element
    const found = this.#locator
      ? findByLocator(this.#document, this.#locator)
      : null
    if (!found) {
      if (++this.#missing === FAILS_BEFORE_NOTICE)
        this.#notices.post(strings.watchElementGone)
      return null
    }
    if (this.#missing >= FAILS_BEFORE_NOTICE)
      this.#notices.post(strings.watchElementBack)
    this.#missing = 0
    this.#attach(found)
    return found
  }

  /** Watches DOM changes of the element and marks it on the page. */
  #attach(element: Element): void {
    this.#element = element
    this.#observer?.disconnect()
    const Observer = this.#document.defaultView?.MutationObserver
    if (Observer) {
      this.#observer = new Observer(() => {
        const now = Date.now()
        if (now - this.#lastSeenAt < SEEN_THROTTLE_MS) return
        this.#lastSeenAt = now
        const text = capText(readWatchedText(element))
        if (
          text !== this.#previous &&
          this.#seen[this.#seen.length - 1] !== text
        ) {
          this.#seen = [...this.#seen, text].slice(-MAX_SEEN)
        }
      })
      this.#observer.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['value', 'aria-valuenow', 'aria-valuetext']
      })
    }
    const strings = this.#config.strings()
    this.#layer?.destroy()
    this.#layer = new MarkerLayer({
      doc: this.#document,
      themeSource: this.#host
    })
    this.#layer.show([
      {
        id: 'watch',
        element,
        badge: strings.watchActiveBadge,
        title: strings.watchModeName,
        text: this.#instruction
      }
    ])
  }

  #count(key: 'checks' | 'matches'): void {
    this.status.update((status) =>
      status ? { ...status, [key]: status[key] + 1 } : status
    )
  }
}
