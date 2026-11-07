import { DOCUMENT } from '@angular/common'
import { Injectable, computed, inject, signal } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import {
  cleanModelText,
  parseJsonFromModelResponse
} from '../../ai/json-response'
import type { ResearchSource } from '../../chat/tool-card.model'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { downloadText, newId } from '../../core/download'
import {
  AddPageResult,
  MAX_RESEARCH_PAGES,
  ResearchData,
  ResearchPage,
  ResearchTopic,
  addResearchPage,
  removeResearchPage,
  topicToMarkdown
} from '../../core/research-data'
import { StorageService } from '../../core/storage.service'
import { ToastService } from '../../core/toast.service'
import { slug } from '../tables/table-formats'

export const RESEARCH_BUDGET = 12_000
const MAX_POINTS = 8
const SHORT_PAGE_WORDS = 100

export function buildPointsPrompt(title: string, text: string): string {
  return [
    `Write up to ${MAX_POINTS} key points from this web page. Each point is one sentence with the facts, names and numbers that matter.`,
    `PAGE TITLE: ${title}`,
    `TEXT:\n${text}`,
    'Answer only with JSON: {"points":["...","..."]}'
  ].join('\n\n')
}

export function parsePoints(answer: string): string[] {
  const json = parseJsonFromModelResponse(answer) as { points?: unknown } | null
  return Array.isArray(json?.points)
    ? json.points
        .filter(
          (point): point is string =>
            typeof point === 'string' && Boolean(point.trim())
        )
        .map(cleanModelText)
        .filter(Boolean)
        .slice(0, MAX_POINTS)
    : []
}

const sourceBlock = (page: ResearchPage, n: number): string =>
  `[${n}] ${page.title || page.url}\n${page.points.map((point) => `- ${point}`).join('\n')}`

export function buildPickPrompt(
  question: string,
  pages: ResearchPage[]
): string {
  return [
    'Pick the sources most likely to answer the question.',
    `QUESTION: ${question}`,
    'SOURCES:',
    ...pages.map(
      (page, i) =>
        `[${i + 1}] ${page.title || page.url} — ${page.points[0] ?? ''}`
    ),
    'Answer only with JSON: {"sources":[<number>, ...]} with at most 5 numbers.'
  ].join('\n')
}

export function buildAnswerPrompt(
  question: string,
  sources: { n: number; page: ResearchPage }[]
): string {
  return [
    'Answer the question using only the sources below. After each claim, add the number of its source in brackets, like [2]. If the sources do not answer it, say so.',
    `QUESTION: ${question}`,
    `SOURCES:\n${sources.map(({ n, page }) => sourceBlock(page, n)).join('\n\n')}`
  ].join('\n\n')
}

/** Removes `[n]` markers that point to no source. Returns the numbers used. */
export function keepValidCitations(
  answer: string,
  valid: Set<number>
): { text: string; used: number[] } {
  const used = new Set<number>()
  const text = answer.replace(/\[(\d+)\]/gu, (match, value: string) => {
    const n = Number(value)
    if (!valid.has(n)) return ''
    used.add(n)
    return match
  })
  return {
    text: text.replace(/ +([.,;])/gu, '$1'),
    used: [...used].sort((a, b) => a - b)
  }
}

/** Research topics: saves page summaries and answers across them. */
@Injectable()
export class ResearchService {
  readonly #ai = inject(AiService)
  readonly #storage = inject(StorageService)
  readonly #toast = inject(ToastService)
  readonly #document = inject(DOCUMENT)
  readonly #strings = inject(ConfigStore).strings

  readonly data = signal<ResearchData>({})
  readonly topicId = signal<string | null>(null)
  readonly topics = computed(() =>
    Object.values(this.data()).sort((a, b) => a.name.localeCompare(b.name))
  )
  readonly topic = computed<ResearchTopic | null>(() => {
    const id = this.topicId()
    return id ? (this.data()[id] ?? null) : null
  })

  async refresh(): Promise<void> {
    const stored = await this.#storage.load()
    this.data.set(stored.research)
    const last = stored.preferences.researchTopic
    if (!this.topicId() && last && stored.research[last]) this.topicId.set(last)
  }

  select(id: string | null): void {
    this.topicId.set(id)
    if (id) void this.#storage.setPreferences({ researchTopic: id })
  }

  async createTopic(name: string): Promise<void> {
    const id = newId()
    const topic: ResearchTopic = {
      id,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      pages: []
    }
    await this.#update((data) => ({ ...data, [id]: topic }))
    this.select(id)
  }

  async renameTopic(id: string, name: string): Promise<void> {
    await this.#update((data) =>
      data[id] ? { ...data, [id]: { ...data[id], name: name.trim() } } : data
    )
  }

  async deleteTopic(id: string): Promise<void> {
    await this.#update((data) => {
      const { [id]: _removed, ...rest } = data
      return rest
    })
    if (this.topicId() === id) this.topicId.set(null)
  }

  async removePage(id: string, url: string): Promise<void> {
    await this.#update((data) => removeResearchPage(data, id, url))
  }

  exportTopic(id: string): void {
    const topic = this.data()[id]
    if (topic)
      downloadText(
        this.#document,
        `${slug(topic.name) || 'research'}.md`,
        topicToMarkdown(topic)
      )
  }

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const topic = this.topic()
    if (!topic) return { content: strings.noTopic }
    const text = request.text.trim()
    if (!text) return this.#addPage(topic, request)
    if (text.toLowerCase() === 'list') {
      return {
        content: topic.name,
        extra: { card: { kind: 'research-pages', topicId: topic.id } }
      }
    }
    return this.#ask(topic, text, request)
  }

  async #addPage(
    topic: ResearchTopic,
    request: ToolRequest
  ): Promise<ToolResult> {
    const strings = this.#strings()
    const doc = this.#document
    const url = doc.location?.href ?? ''
    const exists = topic.pages.some((page) => page.url === url)
    if (!exists && topic.pages.length >= MAX_RESEARCH_PAGES) {
      return {
        content: formatString(strings.researchTopicFull, {
          max: MAX_RESEARCH_PAGES
        })
      }
    }
    const body = (doc.body?.innerText ?? doc.body?.textContent ?? '').trim()
    const answer = await this.#ai.prompt({
      userPrompt: buildPointsPrompt(doc.title, body.slice(0, RESEARCH_BUDGET)),
      agentMode: true,
      signal: request.signal
    })
    const points = parsePoints(answer)
    const page: ResearchPage = {
      url,
      title: doc.title,
      addedAt: new Date().toISOString(),
      points
    }
    const outcome: { result: AddPageResult } = { result: 'full' }
    const saved = await this.#update((data) => {
      const next = addResearchPage(data, topic.id, page)
      outcome.result = next.result
      return next.data
    })
    const result = outcome.result
    if (result === 'full')
      return {
        content: formatString(strings.researchTopicFull, {
          max: MAX_RESEARCH_PAGES
        })
      }
    const count = this.data()[topic.id]?.pages.length ?? 0
    const lines = [
      formatString(
        result === 'updated'
          ? strings.researchPageUpdated
          : strings.researchPageAdded,
        { topic: topic.name, count }
      ),
      '',
      ...points.map((point) => `- ${point}`)
    ]
    if (body.split(/\s+/u).filter(Boolean).length < SHORT_PAGE_WORDS)
      lines.push('', strings.researchPageShort)
    if (!saved) lines.push('', strings.researchSaveFailed)
    return { content: lines.join('\n') }
  }

  async #ask(
    topic: ResearchTopic,
    question: string,
    request: ToolRequest
  ): Promise<ToolResult> {
    const strings = this.#strings()
    if (topic.pages.length === 0) return { content: strings.researchTopicEmpty }
    let chosen = topic.pages.map((page, i) => ({ n: i + 1, page }))
    const size = chosen.reduce(
      (sum, { page, n }) => sum + sourceBlock(page, n).length,
      0
    )
    if (size > RESEARCH_BUDGET) {
      const pick = parseJsonFromModelResponse(
        await this.#ai.prompt({
          userPrompt: buildPickPrompt(question, topic.pages),
          agentMode: true,
          signal: request.signal
        })
      ) as { sources?: unknown } | null
      const numbers = Array.isArray(pick?.sources)
        ? pick.sources.filter((n): n is number => typeof n === 'number')
        : []
      const picked = chosen.filter(({ n }) => numbers.includes(n)).slice(0, 5)
      chosen = picked.length ? picked : chosen.slice(0, 5)
    }
    const answer = await this.#ai.prompt({
      userPrompt: buildAnswerPrompt(question, chosen),
      agentMode: true,
      signal: request.signal,
      onChunk: request.onChunk
    })
    const { text, used } = keepValidCitations(
      answer,
      new Set(chosen.map(({ n }) => n))
    )
    const listed = used.length
      ? chosen.filter(({ n }) => used.includes(n))
      : chosen
    const sources: ResearchSource[] = listed.map(({ n, page }) => ({
      n,
      title: page.title || page.url,
      url: page.url
    }))
    return {
      content: text.trim(),
      extra: { card: { kind: 'research', sources } }
    }
  }

  async #update(
    change: (data: ResearchData) => ResearchData
  ): Promise<boolean> {
    this.data.update(change)
    try {
      await this.#storage.updateStrict((stored) => ({
        ...stored,
        research: change(stored.research)
      }))
      return true
    } catch {
      this.#toast.error(this.#strings().researchSaveFailed)
      return false
    }
  }
}
