import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { BrowseAiCoreStrings, formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import type { RiskLevel, RiskSignal } from '../../chat/tool-card.model'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { revealOnPage } from '../../page/reveal-element'
import {
  PhishingSignal,
  SignalId,
  levelFromScore,
  raiseLevel,
  scanPhishingSignals,
  scoreSignals
} from './phishing-signals'

const SIGNAL_STRINGS: Record<SignalId, keyof BrowseAiCoreStrings> = {
  'insecure-form': 'signalInsecureForm',
  'foreign-action': 'signalForeignAction',
  'odd-host': 'signalOddHost',
  'brand-mismatch': 'signalBrandMismatch',
  'lonely-login': 'signalLonelyLogin',
  'link-mismatch': 'signalLinkMismatch',
  'urgent-text': 'signalUrgentText',
  'blocked-paste': 'signalBlockedPaste'
}

export const LEVEL_STRINGS: Record<RiskLevel, keyof BrowseAiCoreStrings> = {
  low: 'riskLow',
  medium: 'riskMedium',
  high: 'riskHigh'
}

export function buildPhishingPrompt(
  signals: string[],
  title: string,
  host: string,
  text: string
): string {
  return [
    'You check web pages for phishing and scams. Look at the page below and the warning signs found by code.',
    `HOST: ${host}`,
    `TITLE: ${title}`,
    `SIGNS FOUND: ${signals.length ? signals.join('; ') : 'none'}`,
    `PAGE TEXT (start):\n${text}`,
    'Answer only with JSON: {"explanation":"<2 to 3 plain sentences on what the signs mean>","advice":"<one sentence on what the user should do>","raise":<true only if the text is clearly a scam>}'
  ].join('\n\n')
}

interface ModelVerdict {
  explanation: string
  advice: string
  raise: boolean
}

export function parseVerdict(answer: string): ModelVerdict {
  const json = (parseJsonFromModelResponse(answer) ?? {}) as Record<
    string,
    unknown
  >
  return {
    explanation:
      typeof json['explanation'] === 'string' ? json['explanation'].trim() : '',
    advice: typeof json['advice'] === 'string' ? json['advice'].trim() : '',
    raise: json['raise'] === true
  }
}

/** Looks for phishing and scam signs on the current page. */
@Injectable()
export class PhishingCheckService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings
  #elements = new Map<number, Element>()

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const doc = this.#document
    const found = scanPhishingSignals(doc, this.#host)
    this.#elements = new Map()
    const signals: RiskSignal[] = found.map((signal, index) => {
      if (signal.element) this.#elements.set(index, signal.element)
      return {
        id: signal.id,
        text: this.#describe(signal),
        ...(signal.element ? { elementId: index } : {})
      }
    })

    let level = levelFromScore(scoreSignals(found))
    const answer = await this.#ai.prompt({
      userPrompt: buildPhishingPrompt(
        signals.map((signal) => signal.text),
        doc.title,
        doc.location?.hostname ?? '',
        (doc.body?.innerText ?? doc.body?.textContent ?? '')
          .replace(/\s+/gu, ' ')
          .trim()
          .slice(0, 2000)
      ),
      agentMode: true,
      signal: request.signal
    })
    const verdict = parseVerdict(answer)
    level = raiseLevel(level, verdict.raise)

    const lines = [
      `**${strings[LEVEL_STRINGS[level]]}**`,
      '',
      ...(found.length === 0 && level === 'low'
        ? [strings.noPhishingSignals, '']
        : []),
      ...(verdict.explanation ? [verdict.explanation, ''] : []),
      ...(verdict.advice ? [verdict.advice, ''] : []),
      `_${strings.phishingDisclaimer}_`
    ]
    return {
      content: lines.join('\n'),
      extra: { card: { kind: 'phishing', level, signals } }
    }
  }

  reveal(elementId: number): boolean {
    const element = this.#elements.get(elementId)
    if (!element?.isConnected) return false
    revealOnPage(this.#document, this.#host, element)
    return true
  }

  #describe(signal: PhishingSignal): string {
    return formatString(this.#strings()[SIGNAL_STRINGS[signal.id]] as string, {
      detail: signal.detail
    })
  }
}
