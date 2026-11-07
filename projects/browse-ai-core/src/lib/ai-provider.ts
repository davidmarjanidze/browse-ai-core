/**
 * The model behind the chat. The default provider uses Chrome's built-in
 * `LanguageModel` (Prompt API, Gemini Nano). Pass your own object with the
 * same shape to use a different model.
 */

export type AiAvailability =
  'available' | 'downloadable' | 'downloading' | 'unavailable'

export type AiInputType = 'text' | 'image' | 'audio'

export interface AiContentPart {
  type: AiInputType
  value: string | Blob
}

export interface AiPromptMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AiContentPart[]
}

export type AiPromptInput = string | AiPromptMessage[]

export interface AiSessionOptions {
  systemPrompt?: string
  temperature?: number
  topK?: number
  initialPrompts?: AiPromptMessage[]
  expectedInputs?: AiInputType[]
  outputLanguage?: string
  /** Called with a number from 0 to 1 while the model downloads. */
  onDownloadProgress?: (loaded: number) => void
  signal?: AbortSignal
}

export interface AiRequestOptions {
  signal?: AbortSignal
}

export interface AiSession {
  prompt(input: AiPromptInput, options?: AiRequestOptions): Promise<string>
  promptStreaming?(
    input: AiPromptInput,
    options?: AiRequestOptions
  ): ReadableStream<string> | AsyncIterable<string>
  destroy?(): void
  /** Tokens used so far, if the model reports it. */
  contextUsage?: number
  /** Total tokens the session can hold, if the model reports it. */
  contextWindow?: number
}

export interface AiProvider {
  /** Shown in the header badge. */
  readonly name: string
  /** Approximate download size, shown before the model is downloaded. */
  readonly downloadSize?: string
  availability(options?: AiSessionOptions): Promise<AiAvailability>
  createSession(options?: AiSessionOptions): Promise<AiSession>
}

interface LanguageModelFactory {
  availability?: (options?: object) => Promise<AiAvailability>
  create(options?: object): Promise<AiSession>
}

function getLanguageModel(): LanguageModelFactory | null {
  const languageModel = (globalThis as { LanguageModel?: LanguageModelFactory })
    .LanguageModel
  return languageModel?.create ? languageModel : null
}

function toChromeOptions(options: AiSessionOptions = {}): object {
  const initialPrompts: AiPromptMessage[] = [
    ...(options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }]
      : []),
    ...(options.initialPrompts ?? [])
  ]

  return {
    expectedInputs: (options.expectedInputs ?? ['text']).map((type) => ({
      type
    })),
    ...(options.outputLanguage && {
      expectedOutputs: [{ type: 'text', languages: [options.outputLanguage] }],
      outputLanguage: options.outputLanguage
    }),
    ...(initialPrompts.length > 0 && { initialPrompts }),
    ...(options.temperature !== undefined && {
      temperature: options.temperature
    }),
    ...(options.topK !== undefined && { topK: options.topK }),
    ...(options.signal && { signal: options.signal }),
    ...(options.onDownloadProgress && {
      monitor: (monitor: EventTarget) => {
        monitor.addEventListener('downloadprogress', (event) => {
          options.onDownloadProgress?.(
            (event as Event & { loaded: number }).loaded
          )
        })
      }
    })
  }
}

/** Chrome's built-in model. Reports `unavailable` in other browsers. */
export function chromeLanguageModelProvider(): AiProvider {
  return {
    name: 'Gemini Nano',
    downloadSize: '1.5 to 2 GB',
    async availability(options) {
      const languageModel = getLanguageModel()
      if (!languageModel) return 'unavailable'
      if (!languageModel.availability) return 'downloadable'

      try {
        return await languageModel.availability(toChromeOptions(options))
      } catch {
        return 'unavailable'
      }
    },
    async createSession(options) {
      const languageModel = getLanguageModel()
      if (!languageModel) {
        throw new Error('This browser does not have a built-in AI model.')
      }
      return languageModel.create(toChromeOptions(options))
    }
  }
}
