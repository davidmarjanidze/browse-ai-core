import { DOCUMENT } from '@angular/common'
import { Injectable, inject, signal } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import { BuiltInAiService } from '../../ai/built-in/built-in-ai.service'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { ToastService } from '../../core/toast.service'
import { FieldTrackerService } from '../../page/field-tracker.service'
import {
  TextField,
  maxLengthOf,
  readFieldValue,
  setFieldValue
} from '../../page/insert-text'

export type ReplyTone = 'formal' | 'neutral' | 'casual'
export type ReplyLength = 'short' | 'medium' | 'long'

const NEARBY_MAX = 3000
const MIN_CONTEXT = 200

/**
 * Text the reply answers: the text before the field inside the nearest
 * ancestor that has at least 200 characters besides the field.
 */
export function nearbyText(field: Element): string {
  const doc = field.ownerDocument
  let container: Element | null = field.parentElement
  while (container && container !== doc.body) {
    const own =
      (container.textContent ?? '').length - (field.textContent ?? '').length
    if (own >= MIN_CONTEXT) break
    container = container.parentElement
  }
  container ??= doc.body
  if (!container) return ''
  const range = doc.createRange()
  range.setStart(container, 0)
  range.setEndBefore(field)
  let text = range.toString().replace(/\s+/gu, ' ').trim()
  if (text.length < 50) {
    text = (container.textContent ?? '').replace(/\s+/gu, ' ').trim()
  }
  return text.slice(-NEARBY_MAX)
}

export function buildReplyPrompt(
  instructions: string,
  nearby: string,
  title: string,
  tone: ReplyTone,
  length: ReplyLength
): string {
  const words = { short: 'up to 60', medium: '60 to 150', long: '150 to 300' }[
    length
  ]
  return [
    'Write a reply that the user will post in a text box on a web page.',
    `PAGE TITLE: ${title}`,
    `TEXT THE REPLY ANSWERS:\n${nearby || '(none found)'}`,
    `TONE: ${tone}. LENGTH: ${words} words.`,
    instructions ? `USER INSTRUCTIONS: ${instructions}` : '',
    'Output only the reply text, with no greeting line about being an AI and no quotes around it.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export type InsertMode = 'replace' | 'append'

/** Drafts a reply for a text box on the page and inserts it on request. */
@Injectable()
export class ReplyDrafterService {
  readonly #ai = inject(AiService)
  readonly #builtIn = inject(BuiltInAiService)
  readonly #tracker = inject(FieldTrackerService)
  readonly #toast = inject(ToastService)
  readonly #document = inject(DOCUMENT)
  readonly #strings = inject(ConfigStore).strings

  readonly tone = signal<ReplyTone>('neutral')
  readonly length = signal<ReplyLength>('short')
  /** The instructions of the last draft, for Redo. */
  lastInstructions = ''
  #target: TextField | null = null

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const field = this.#tracker.currentField()
    if (!field) return { content: strings.noReplyField }
    this.#target = field
    this.lastInstructions = request.text

    const nearby = nearbyText(field)
    const title = this.#document.title
    let content: string
    if (this.#builtIn.exists('writer') && this.#builtIn.isReady('writer')) {
      const task =
        request.text || 'Write a reply to the text in the shared context.'
      content = await this.#builtIn.run(
        'writer',
        task,
        request.signal,
        request.onChunk,
        {
          tone: this.tone(),
          length: this.length(),
          format: 'plain-text',
          sharedContext: `Page: ${title}\n\n${nearby}`
        }
      )
    } else {
      content = await this.#ai.prompt({
        userPrompt: buildReplyPrompt(
          request.text,
          nearby,
          title,
          this.tone(),
          this.length()
        ),
        agentMode: true,
        signal: request.signal,
        onChunk: request.onChunk
      })
    }
    return {
      content: content.trim(),
      extra: { card: { kind: 'reply', fieldLabel: this.#tracker.fieldLabel() } }
    }
  }

  /** True when the target box already has text, so the user must choose. */
  needsChoice(): boolean {
    const target = this.#target
    return Boolean(target?.isConnected && readFieldValue(target).trim())
  }

  /** Puts the draft into the box. Returns false when the box is gone. */
  insert(draft: string, mode: InsertMode = 'replace'): boolean {
    const strings = this.#strings()
    const target = this.#target
    if (!target?.isConnected) {
      this.#toast.error(strings.replyFieldGone)
      return false
    }
    const current = readFieldValue(target)
    let value =
      mode === 'append' && current.trim()
        ? `${current.trimEnd()}\n\n${draft}`
        : draft
    const max = maxLengthOf(target)
    if (max !== null && value.length > max) {
      value = value.slice(0, max)
      this.#toast.show(formatString(strings.replyCut, { max }))
    }
    setFieldValue(target, value)
    target.focus()
    this.#toast.success(strings.replyInserted)
    return true
  }

  reset(): void {
    this.#target = null
  }
}
