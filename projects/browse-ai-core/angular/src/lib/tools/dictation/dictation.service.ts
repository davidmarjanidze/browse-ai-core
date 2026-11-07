import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { ToastService } from '../../core/toast.service'
import { FieldTrackerService } from '../../page/field-tracker.service'
import { insertAtCursor } from '../../page/insert-text'

export const TRANSCRIBE_PROMPT =
  'Write exactly what is said in the audio. Output only the text, with no notes.'

export function buildCommandPrompt(command: string, text: string): string {
  return [
    `Change the text below as asked: ${command}`,
    `TEXT:\n${text}`,
    'Output only the changed text.'
  ].join('\n\n')
}

/** Turns recorded speech into text with the chat model's audio input. */
export async function transcribe(
  ai: AiService,
  audioData: string,
  signal?: AbortSignal
): Promise<string> {
  const text = await ai.prompt({
    userPrompt: TRANSCRIBE_PROMPT,
    agentMode: true,
    audioData,
    signal
  })
  return text
    .trim()
    .replace(/^["“]|["”]$/gu, '')
    .trim()
}

/** The Dictation tool: types what the user says into a page text box. */
@Injectable()
export class DictationService {
  readonly #ai = inject(AiService)
  readonly #tracker = inject(FieldTrackerService)
  readonly #toast = inject(ToastService)
  readonly #strings = inject(ConfigStore).strings

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    if (!request.audio) return { content: strings.dictationNeedsAudio }
    let text = await transcribe(this.#ai, request.audio, request.signal)
    if (!text) return { content: strings.noSpeechHeard }
    if (request.text) {
      text = (
        await this.#ai.prompt({
          userPrompt: buildCommandPrompt(request.text, text),
          agentMode: true,
          signal: request.signal
        })
      ).trim()
    }
    const field = this.#tracker.currentField()
    if (!field) return { content: `${strings.dictationNoField}\n\n${text}` }
    insertAtCursor(field, text)
    this.#toast.success(strings.dictationInserted)
    return { content: text }
  }
}
