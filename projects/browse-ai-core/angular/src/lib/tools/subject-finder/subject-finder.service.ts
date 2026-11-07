import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { pickCandidates } from './rank-blocks'
import { TextBlock, collectTextBlocks } from './text-blocks'

const HIGHLIGHT_NAME = 'browse-ai-core-subject'
const HIGHLIGHT_STYLE_ID = 'browse-ai-core-subject-style'
const HIGHLIGHT_MS = 2500

export function buildFinderPrompt(
  request: string,
  blocks: TextBlock[]
): string {
  return [
    'Below are numbered parts of a web page. Find the part that best matches what the user is looking for.',
    `USER IS LOOKING FOR: ${request}`,
    'PAGE PARTS:',
    ...blocks.map((block, index) => `[${index}] ${block.text}`),
    'Answer only with JSON: {"index": <number>} for the best part, or {"index": null} if no part matches.'
  ].join('\n')
}

/** The picked index, or null when it is missing or out of range. */
export function parseFinderAnswer(
  answer: string,
  count: number
): number | null {
  const json = parseJsonFromModelResponse(answer) as { index?: unknown } | null
  const index = json?.index
  return typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < count
    ? index
    : null
}

/** Finds the part of the page the user describes and scrolls to it. */
@Injectable()
export class SubjectFinderService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  #clearTimer: ReturnType<typeof setTimeout> | undefined

  /** Returns the element scrolled to, or null when nothing matches. */
  async find(request: string, signal: AbortSignal): Promise<Element | null> {
    const blocks = pickCandidates(
      request,
      collectTextBlocks(this.#document, this.#host)
    )
    if (blocks.length === 0) return null

    const answer = await this.#ai.prompt({
      userPrompt: buildFinderPrompt(request, blocks),
      agentMode: true,
      signal
    })
    const index = parseFinderAnswer(answer, blocks.length)
    const element = index === null ? null : blocks[index].element
    if (!element?.isConnected) return null

    this.#reveal(element)
    return element
  }

  #reveal(element: Element): void {
    for (
      let details = element.closest('details:not([open])');
      details;
      details = details.parentElement?.closest('details:not([open])') ?? null
    ) {
      ;(details as HTMLDetailsElement).open = true
    }
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    this.#highlight(element)
  }

  #highlight(element: Element): void {
    const view = this.#document.defaultView as
      (Window & { CSS?: { highlights?: Map<string, unknown> } }) | null
    const highlights = view?.CSS?.highlights
    const Highlight = (
      globalThis as { Highlight?: new (range: Range) => object }
    ).Highlight
    if (!highlights || !Highlight) return

    this.#addStyle()
    const range = this.#document.createRange()
    range.selectNodeContents(element)
    highlights.set(HIGHLIGHT_NAME, new Highlight(range))
    clearTimeout(this.#clearTimer)
    this.#clearTimer = setTimeout(
      () => highlights.delete(HIGHLIGHT_NAME),
      HIGHLIGHT_MS
    )
  }

  #addStyle(): void {
    const doc = this.#document
    let style = doc.getElementById(HIGHLIGHT_STYLE_ID)
    if (!style) {
      style = doc.createElement('style')
      style.id = HIGHLIGHT_STYLE_ID
      doc.head.appendChild(style)
    }
    // Page CSS can't see the chat's variables, so copy the theme colors.
    const theme = getComputedStyle(this.#host)
    const color = (name: string, fallback: string) =>
      theme.getPropertyValue(name).trim() || fallback
    style.textContent = `::highlight(${HIGHLIGHT_NAME}){background-color:${color('--bac-primary', '#2563eb')};color:${color('--bac-on-primary', '#fff')};}`
  }
}
