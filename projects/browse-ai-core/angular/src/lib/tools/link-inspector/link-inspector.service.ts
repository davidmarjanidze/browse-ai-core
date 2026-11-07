import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { revealOnPage } from '../../page/reveal-element'
import { LinkRow, scanLinks } from './link-scanner'

const MAX_LINKS = 300
const MAX_CHARS = 12_000
const MAX_MATCHES = 5

/** Numbered `index | text | path` lines, cut to the prompt budget. */
export function buildLinkPrompt(
  request: string,
  rows: LinkRow[],
  pageHost: string
): string {
  const lines: string[] = []
  let size = 0
  for (const row of rows.slice(0, MAX_LINKS)) {
    let target = row.url
    try {
      const url = new URL(row.url)
      target = url.hostname === pageHost ? url.pathname + url.search : row.url
    } catch {
      // Keep the raw href.
    }
    const line = `[${row.id}] ${row.text || '(no text)'} | ${target}`
    if (size + line.length > MAX_CHARS) break
    lines.push(line)
    size += line.length + 1
  }
  return [
    'Below are numbered links from a web page. Pick the links that best match what the user wants.',
    `USER WANTS: ${request}`,
    'LINKS:',
    ...lines,
    `Answer only with JSON: {"matches":[{"index":<number>,"reason":"<short reason>"}]}, best first, at most ${MAX_MATCHES}. Use {"matches":[]} if nothing matches.`
  ].join('\n')
}

/** Matches that point to real rows, best first. Unknown indexes are dropped. */
export function parseLinkMatches(answer: string, rows: LinkRow[]): LinkRow[] {
  const json = parseJsonFromModelResponse(answer) as {
    matches?: unknown
  } | null
  if (!Array.isArray(json?.matches)) return []
  const byId = new Map(rows.map((row) => [row.id, row]))
  const result: LinkRow[] = []
  for (const match of json.matches as { index?: unknown; reason?: unknown }[]) {
    const row =
      typeof match?.index === 'number' ? byId.get(match.index) : undefined
    if (!row || result.some((entry) => entry.id === row.id)) continue
    result.push({
      ...row,
      reason: typeof match.reason === 'string' ? match.reason : undefined
    })
    if (result.length === MAX_MATCHES) break
  }
  return result
}

/** Sorts rows so links nearest to the screen come first. */
function byDistanceToViewport(
  rows: LinkRow[],
  elements: Map<number, Element[]>,
  viewportHeight: number
): LinkRow[] {
  const distance = (row: LinkRow): number => {
    const rect = elements.get(row.id)?.[0]?.getBoundingClientRect()
    if (!rect) return Infinity
    if (rect.bottom >= 0 && rect.top <= viewportHeight) return 0
    return rect.top < 0 ? -rect.bottom : rect.top - viewportHeight
  }
  return [...rows].sort((a, b) => distance(a) - distance(b))
}

/** Lists the page's links and finds the ones the user asks for. */
@Injectable()
export class LinkInspectorService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings
  #elements = new Map<number, Element[]>()

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const { rows, elements } = scanLinks(this.#document, this.#host)
    this.#elements = elements
    if (rows.length === 0) return { content: strings.noLinks }

    const all = { kind: 'links' as const, links: rows, matched: false }
    if (!request.text) {
      return {
        content: formatString(strings.linksFound, { count: rows.length }),
        extra: { card: all }
      }
    }

    const ordered = byDistanceToViewport(
      rows,
      elements,
      this.#document.defaultView?.innerHeight ?? 800
    )
    const answer = await this.#ai.prompt({
      userPrompt: buildLinkPrompt(
        request.text,
        ordered,
        this.#document.location?.hostname ?? ''
      ),
      agentMode: true,
      signal: request.signal
    })
    const matches = parseLinkMatches(answer, rows)
    if (matches.length === 0) {
      return { content: strings.noMatchingLinks, extra: { card: all } }
    }
    return {
      content: strings.linksMatched,
      extra: { card: { kind: 'links', links: matches, matched: true } }
    }
  }

  /** Scrolls to the first element of a link row and highlights it. */
  reveal(id: number): boolean {
    const element = this.#elements.get(id)?.find((entry) => entry.isConnected)
    if (!element) return false
    revealOnPage(this.#document, this.#host, element)
    return true
  }
}
