import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import {
  cleanModelText,
  parseJsonFromModelResponse
} from '../../ai/json-response'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { FoundReview, reviewStats, scanReviews } from './review-scanner'

export const REVIEW_PART_SIZE = 10_000

export interface ReviewSummary {
  pros: string[]
  cons: string[]
  complaints: string[]
  verdict: string
}

/** Splits reviews into parts of at most `size` characters. */
export function reviewParts(
  reviews: FoundReview[],
  size = REVIEW_PART_SIZE
): string[] {
  const parts: string[] = []
  let current = ''
  for (const review of reviews) {
    const line = `- ${review.rating !== null ? `(${review.rating}/5) ` : ''}${review.text.slice(0, size - 10)}\n`
    if (current && current.length + line.length > size) {
      parts.push(current)
      current = ''
    }
    current += line
  }
  if (current) parts.push(current)
  return parts
}

export function buildPartPrompt(
  reviews: string,
  focus: string,
  withVerdict: boolean
): string {
  return [
    'Read these customer reviews and list what people say. Use only what is in the reviews.',
    focus ? `FOCUS ONLY ON: ${focus}` : '',
    `REVIEWS:\n${reviews}`,
    withVerdict
      ? 'Answer only with JSON: {"pros":["..."],"cons":["..."],"complaints":["..."],"verdict":"<one paragraph>"}. At most 5 items per list.'
      : 'Answer only with JSON: {"pros":["..."],"cons":["..."],"complaints":["..."]}. At most 5 items per list.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildCombinePrompt(
  parts: ReviewSummary[],
  focus: string
): string {
  const list = (name: string, items: string[]) =>
    `${name}:\n${items.map((item) => `- ${item}`).join('\n')}`
  return [
    'Below are summaries of different groups of reviews for the same product. Merge them: remove repeats and keep the most common points.',
    focus ? `FOCUS ONLY ON: ${focus}` : '',
    list(
      'PROS',
      parts.flatMap((part) => part.pros)
    ),
    list(
      'CONS',
      parts.flatMap((part) => part.cons)
    ),
    list(
      'COMPLAINTS',
      parts.flatMap((part) => part.complaints)
    ),
    'Answer only with JSON: {"pros":["..."],"cons":["..."],"complaints":["..."],"verdict":"<one paragraph>"}. At most 5 items per list.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

const strings5 = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(item.trim())
        )
        .map(cleanModelText)
        .filter(Boolean)
        .slice(0, 5)
    : []

export function parseReviewSummary(answer: string): ReviewSummary {
  const json = (parseJsonFromModelResponse(answer) ?? {}) as Record<
    string,
    unknown
  >
  return {
    pros: strings5(json['pros']),
    cons: strings5(json['cons']),
    complaints: strings5(json['complaints']),
    verdict: typeof json['verdict'] === 'string' ? json['verdict'].trim() : ''
  }
}

/** Finds the reviews on the page and sums them up. */
@Injectable()
export class ReviewSummarizerService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const reviews = scanReviews(this.#document, this.#host)
    if (reviews.length < 2) return { content: strings.noReviews }

    const stats = reviewStats(reviews)
    const parts = reviewParts(reviews)
    const ask = (prompt: string) =>
      this.#ai.prompt({
        userPrompt: prompt,
        agentMode: true,
        signal: request.signal
      })

    let summary: ReviewSummary
    if (parts.length === 1) {
      summary = parseReviewSummary(
        await ask(buildPartPrompt(parts[0], request.text, true))
      )
    } else {
      const partial: ReviewSummary[] = []
      for (const part of parts) {
        partial.push(
          parseReviewSummary(
            await ask(buildPartPrompt(part, request.text, false))
          )
        )
      }
      summary = parseReviewSummary(
        await ask(buildCombinePrompt(partial, request.text))
      )
    }

    const section = (title: string, items: string[]) =>
      items.length
        ? [`**${title}**`, ...items.map((item) => `- ${item}`), '']
        : []
    const content = [
      `**${strings.reviewsRead}:** ${stats.count}`,
      ...(stats.average !== null
        ? [`**${strings.averageRating}:** ${stats.average} / 5`]
        : []),
      '',
      ...section(strings.pros, summary.pros),
      ...section(strings.cons, summary.cons),
      ...section(strings.complaints, summary.complaints),
      ...(summary.verdict
        ? [`**${strings.verdict}**`, summary.verdict, '']
        : []),
      `_${formatString(strings.reviewsBasis, { count: stats.count })}_`
    ].join('\n')
    return { content, extra: { card: { kind: 'reviews', stats } } }
  }
}
