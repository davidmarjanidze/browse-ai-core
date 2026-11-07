import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { BrowseAiCoreStrings, formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import type {
  DarkPatternFinding,
  DarkPatternType
} from '../../chat/tool-card.model'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { ToastService } from '../../core/toast.service'
import { MarkerLayer } from '../../page/marker-layer'
import { revealOnPage } from '../../page/reveal-element'
import {
  Finding,
  scanDarkPatterns,
  timerCandidates,
  timerSeconds
} from './dark-pattern-scanner'

export const TIMER_WAIT_MS = 3000
const MAX_CANDIDATES = 40
const TIMER_KEY = 'browse-ai-core-timers'

export const PATTERN_STRINGS: Record<
  DarkPatternType,
  [keyof BrowseAiCoreStrings, keyof BrowseAiCoreStrings]
> = {
  prechecked: ['patternPrechecked', 'patternPrecheckedWhy'],
  timer: ['patternTimer', 'patternTimerWhy'],
  scarcity: ['patternScarcity', 'patternScarcityWhy'],
  shaming: ['patternShaming', 'patternShamingWhy'],
  'weak-decline': ['patternWeakDecline', 'patternWeakDeclineWhy'],
  sneak: ['patternSneak', 'patternSneakWhy'],
  'hard-cancel': ['patternHardCancel', 'patternHardCancelWhy']
}

export function buildConfirmPrompt(candidates: Finding[]): string {
  return [
    'Below are short texts from a web page. Mark the ones that are dark patterns: confirmshaming (decline text that guilt-trips the user), fake or pushy scarcity claims, or items and fees added to a cart without the user asking.',
    ...candidates.map(
      (finding, index) =>
        `[${index}] (${finding.type}) ${finding.evidence.slice(0, 200)}`
    ),
    'Answer only with JSON: {"confirmed":[{"index":<number>,"reason":"<short reason>"}]}'
  ].join('\n')
}

export function parseConfirmed(answer: string, count: number): Set<number> {
  const json = parseJsonFromModelResponse(answer) as {
    confirmed?: unknown
  } | null
  const result = new Set<number>()
  if (!Array.isArray(json?.confirmed)) return result
  for (const entry of json.confirmed as { index?: unknown }[]) {
    if (
      typeof entry?.index === 'number' &&
      entry.index >= 0 &&
      entry.index < count
    )
      result.add(entry.index)
  }
  return result
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

/** Finds dark patterns on the page, marks them and explains them. */
@Injectable()
export class DarkPatternDetectorService {
  readonly #ai = inject(AiService)
  readonly #toast = inject(ToastService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings
  #layer: MarkerLayer | null = null
  #elements = new Map<number, Element>()

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    this.clear()
    const timers = await this.#checkTimers(request)
    const found = scanDarkPatterns(this.#document, this.#host)
    const textBased = found
      .filter((finding) => finding.needsModel)
      .slice(0, MAX_CANDIDATES)
    let confirmed = new Set<number>()
    let modelFailed = false
    if (textBased.length) {
      try {
        const answer = await this.#ai.prompt({
          userPrompt: buildConfirmPrompt(textBased),
          agentMode: true,
          signal: request.signal
        })
        confirmed = parseConfirmed(answer, textBased.length)
      } catch (error) {
        if (request.signal.aborted) throw error
        modelFailed = true
      }
    }
    const kept = [
      ...timers,
      ...found.filter((finding) => {
        if (!finding.needsModel) return true
        const index = textBased.indexOf(finding)
        if (modelFailed) return finding.type !== 'shaming' && index >= 0
        return confirmed.has(index)
      })
    ]
    if (kept.length === 0) return { content: strings.noDarkPatterns }

    const findings: DarkPatternFinding[] = kept.map((finding, index) => {
      this.#elements.set(index + 1, finding.element)
      const why = finding.likelyFake
        ? strings.patternTimerFake
        : (strings[PATTERN_STRINGS[finding.type][1]] as string)
      return {
        n: index + 1,
        type: finding.type,
        evidence: finding.evidence,
        why,
        canUncheck: finding.type === 'prechecked'
      }
    })
    this.#mark(findings)
    return {
      content: formatString(strings.darkPatternsFound, {
        count: findings.length
      }),
      extra: { card: { kind: 'dark-patterns', findings } }
    }
  }

  reveal(n: number): void {
    const element = this.#elements.get(n)
    if (element?.isConnected) revealOnPage(this.#document, this.#host, element)
  }

  /** Turns off a pre-checked box by clicking it, so the page sees a real change. */
  uncheck(n: number): void {
    const element = this.#elements.get(n)
    if (!element?.isConnected) return
    const checked =
      element instanceof HTMLInputElement
        ? element.checked
        : element.getAttribute('aria-checked') === 'true'
    if (checked) (element as HTMLElement).click()
    this.#layer?.remove(String(n))
    this.#toast.success(this.#strings().unchecked)
  }

  get markCount(): number {
    return this.#layer?.size ?? 0
  }

  clear(): void {
    this.#layer?.destroy()
    this.#layer = null
    this.#elements.clear()
  }

  #mark(findings: DarkPatternFinding[]): void {
    const strings = this.#strings()
    this.#layer = new MarkerLayer({
      doc: this.#document,
      themeSource: this.#host
    })
    this.#layer.show(
      findings.map((finding) => ({
        id: String(finding.n),
        element: this.#elements.get(finding.n)!,
        badge: String(finding.n),
        title: strings[PATTERN_STRINGS[finding.type][0]] as string,
        text: finding.why,
        ...(finding.canUncheck
          ? {
              action: {
                label: strings.uncheck,
                run: () => this.uncheck(finding.n)
              }
            }
          : {})
      }))
    )
  }

  /** Reads timer texts twice, 3 seconds apart. Skipped when there are none. */
  async #checkTimers(request: ToolRequest): Promise<Finding[]> {
    const candidates = timerCandidates(this.#document, this.#host)
    if (candidates.length === 0) return []
    const first = candidates.map((element) => element.textContent ?? '')
    request.onStatus(this.#strings().checkingTimers)
    await wait(TIMER_WAIT_MS, request.signal)
    request.onStatus('')
    const seen = this.#loadSeen()
    const findings: Finding[] = []
    candidates.forEach((element, index) => {
      const now = element.textContent ?? ''
      if (now === first[index]) return
      const seconds = timerSeconds(now)
      const key = `${this.#document.location?.pathname ?? ''}#${index}`
      const before = seen[key]
      const elapsed = before ? (Date.now() - before.at) / 1000 : 0
      const likelyFake = Boolean(
        before && seconds !== null && seconds > before.seconds - elapsed + 5
      )
      if (seconds !== null) seen[key] = { seconds, at: Date.now() }
      findings.push({
        type: 'timer',
        element,
        evidence: now.trim().slice(0, 200),
        needsModel: false,
        likelyFake
      })
    })
    this.#saveSeen(seen)
    return findings
  }

  #loadSeen(): Record<string, { seconds: number; at: number }> {
    try {
      return JSON.parse(sessionStorage.getItem(TIMER_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  #saveSeen(value: Record<string, { seconds: number; at: number }>): void {
    try {
      sessionStorage.setItem(TIMER_KEY, JSON.stringify(value))
    } catch {
      // Session storage can be blocked. Fake-timer detection is then skipped.
    }
  }
}
