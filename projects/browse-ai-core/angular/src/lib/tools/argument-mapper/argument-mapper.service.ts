import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import type {
  ArgumentMap,
  ArgumentPoint,
  Evidence
} from '../../chat/tool-card.model'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { findTextRange } from '../../page/find-text-range'
import { PageContextService } from '../../page/page-context.service'
import { revealOnPage } from '../../page/reveal-element'

export const ARGUMENT_BUDGET = 12_000
const MAX_PER_SIDE = 6
const EVIDENCE: readonly Evidence[] = ['quote', 'data', 'source', 'none']

export function buildArgumentPrompt(text: string, focus: string): string {
  return [
    'Map the argument in the text below. Find the main claim, the points that support it and the points against it (counterpoints the text mentions or answers).',
    focus ? `FOCUS ONLY ON: ${focus}` : '',
    `TEXT:\n${text}`,
    `Answer only with JSON: {"claim":"<main claim>","points":[{"type":"support"|"counter","text":"<the point in your words>","evidence":"quote"|"data"|"source"|"none","quote":"<short exact words copied from the text>","points":[<sub-points, same shape, no deeper>]}]}. At most ${MAX_PER_SIDE} support and ${MAX_PER_SIDE} counter points.`
  ]
    .filter(Boolean)
    .join('\n\n')
}

function toPoint(value: unknown, depth: number): ArgumentPoint | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const text = typeof record['text'] === 'string' ? record['text'].trim() : ''
  if (!text) return null
  const evidence = EVIDENCE.includes(record['evidence'] as Evidence)
    ? (record['evidence'] as Evidence)
    : 'none'
  const children =
    depth === 0 && Array.isArray(record['points']) ? record['points'] : []
  return {
    type: record['type'] === 'counter' ? 'counter' : 'support',
    text,
    evidence,
    quote: typeof record['quote'] === 'string' ? record['quote'].trim() : '',
    points: children
      .map((child) => toPoint(child, 1))
      .filter((point): point is ArgumentPoint => point !== null)
      .slice(0, MAX_PER_SIDE)
  }
}

/** The map, or null when the answer has no claim. */
export function parseArgumentMap(answer: string): ArgumentMap | null {
  const json = parseJsonFromModelResponse(answer) as Record<
    string,
    unknown
  > | null
  const claim = typeof json?.['claim'] === 'string' ? json['claim'].trim() : ''
  if (!claim) return null
  const points = (Array.isArray(json?.['points']) ? json['points'] : [])
    .map((point) => toPoint(point, 0))
    .filter((point): point is ArgumentPoint => point !== null)
  const support = points
    .filter((point) => point.type === 'support')
    .slice(0, MAX_PER_SIDE)
  const counter = points
    .filter((point) => point.type === 'counter')
    .slice(0, MAX_PER_SIDE)
  return { claim, points: [...support, ...counter] }
}

/** Nested Markdown list of a map. */
export function argumentToMarkdown(
  map: ArgumentMap,
  labels: { claim: string; support: string; counter: string }
): string {
  const lines = [`**${labels.claim}:** ${map.claim}`, '']
  for (const [type, title] of [
    ['support', labels.support],
    ['counter', labels.counter]
  ] as const) {
    const points = map.points.filter((point) => point.type === type)
    if (!points.length) continue
    lines.push(`**${title}**`)
    for (const point of points) {
      lines.push(`- ${point.text} (${point.evidence})`)
      for (const child of point.points)
        lines.push(`  - ${child.text} (${child.evidence})`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** Breaks a text into its main claim, points for and points against. */
@Injectable()
export class ArgumentMapperService {
  readonly #ai = inject(AiService)
  readonly #page = inject(PageContextService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const context = this.#page.currentContext()
    const selected = context?.selectedText?.trim()
    const text = (selected || context?.mainText || '').slice(0, ARGUMENT_BUDGET)
    if (!text) return { content: strings.noArgumentFound }
    const answer = await this.#ai.prompt({
      userPrompt: buildArgumentPrompt(text, request.text),
      agentMode: true,
      signal: request.signal
    })
    const map = parseArgumentMap(answer)
    if (!map) return { content: strings.noArgumentFound }
    return {
      content: `**${strings.mainClaim}:** ${map.claim}`,
      extra: { card: { kind: 'argument', map } }
    }
  }

  /** True when the quote can be found on the page. */
  canFind(quote: string): boolean {
    return (
      Boolean(quote) &&
      findTextRange(this.#document, quote, '', '', this.#host) !== null
    )
  }

  reveal(quote: string): boolean {
    const range = findTextRange(this.#document, quote, '', '', this.#host)
    if (!range) return false
    revealOnPage(this.#document, this.#host, range)
    return true
  }
}
