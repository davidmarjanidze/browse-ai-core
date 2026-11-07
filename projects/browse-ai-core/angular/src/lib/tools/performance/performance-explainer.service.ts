import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { revealOnPage } from '../../page/reveal-element'
import { METRIC_IDS, MetricId, rate, shortUrl } from './metrics'
import { PerformanceCollectorService } from './performance-collector.service'

export const SUMMARY_MAX = 4000

export interface PerformanceSummary {
  metrics: Partial<Record<MetricId, { value: number; rating: string }>>
  lcpElement: string
  longTasks: { count: number; totalMs: number }
  largestFiles: { url: string; type: string; kb: number }[]
  slowestFiles: { url: string; type: string; ms: number }[]
}

/** A short JSON summary under 4,000 characters, never the full entry lists. */
export function summaryJson(summary: PerformanceSummary): string {
  const copy: PerformanceSummary = structuredClone(summary)
  let json = JSON.stringify(copy)
  while (
    json.length > SUMMARY_MAX &&
    (copy.largestFiles.length || copy.slowestFiles.length)
  ) {
    if (copy.slowestFiles.length >= copy.largestFiles.length)
      copy.slowestFiles.pop()
    else copy.largestFiles.pop()
    json = JSON.stringify(copy)
  }
  return json.slice(0, SUMMARY_MAX)
}

export function buildPerformancePrompt(json: string, question: string): string {
  return [
    'You are a web performance expert. Below is performance data measured on the page the user is viewing (times in ms; ratings use Google Core Web Vitals limits).',
    `DATA: ${json}`,
    question
      ? `Answer the user's question using this data: ${question}`
      : 'List the 3 biggest problems, ordered by impact. For each one give the likely cause and a concrete fix. If everything is good, say so and give one tip. Use short Markdown.'
  ].join('\n\n')
}

/** Explains the numbers the collector gathered. */
@Injectable()
export class PerformanceExplainerService {
  readonly #ai = inject(AiService)
  readonly #collector = inject(PerformanceCollectorService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  summary(): PerformanceSummary {
    const values = this.#collector.metrics()
    const metrics: PerformanceSummary['metrics'] = {}
    for (const id of METRIC_IDS) {
      const value = values[id]
      if (value !== null)
        metrics[id] = {
          value: Math.round(value * 1000) / 1000,
          rating: rate(id, value)
        }
    }
    return {
      metrics,
      lcpElement: this.#collector.lcpDescription(),
      longTasks: {
        count: this.#collector.longTaskCount,
        totalMs: Math.round(this.#collector.longTaskTotal)
      },
      largestFiles: this.#collector
        .largestResources()
        .slice(0, 10)
        .map((file) => ({
          url: shortUrl(file.url),
          type: file.type,
          kb: file.sizeKb
        })),
      slowestFiles: this.#collector
        .slowestResources()
        .slice(0, 10)
        .map((file) => ({
          url: shortUrl(file.url),
          type: file.type,
          ms: file.durationMs
        }))
    }
  }

  async run(request: ToolRequest): Promise<ToolResult> {
    this.#collector.start()
    this.#collector.sample()
    const content = await this.#ai.prompt({
      userPrompt: buildPerformancePrompt(
        summaryJson(this.summary()),
        request.text
      ),
      agentMode: true,
      signal: request.signal,
      onChunk: request.onChunk
    })
    return { content, extra: { card: { kind: 'performance' } } }
  }

  revealLcp(): boolean {
    const element = this.#collector.lcpElement
    if (!element) return false
    revealOnPage(this.#document, this.#host, element)
    return true
  }
}
