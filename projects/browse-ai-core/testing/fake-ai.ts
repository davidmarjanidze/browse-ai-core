import { Provider } from '@angular/core'
import {
  AiAvailability,
  AiPromptInput,
  AiProvider,
  AiSession,
  AiSessionOptions,
  BrowseAiCoreConfig,
  memoryStorageAdapter
} from 'browse-ai-core'
import { BROWSE_AI_CORE_CONFIG } from '../angular/src/lib/core/config.store'
import { BAC_HOST_ELEMENT } from '../angular/src/lib/core/host-element'
import { CHAT_INSTANCE_PROVIDERS } from '../angular/src/lib/providers'

export interface FakeAiOptions {
  availability?: AiAvailability
  /** Answer for a prompt. Split into chunks of `chunkSize` characters. */
  reply?: string | ((input: AiPromptInput) => string)
  chunkSize?: number
  /** Milliseconds between chunks. */
  chunkDelay?: number
  error?: Error
}

export interface FakeAi {
  provider: AiProvider
  sessions: AiSessionOptions[]
  inputs: AiPromptInput[]
  destroyed: number
}

export function promptText(input: AiPromptInput): string {
  if (typeof input === 'string') return input
  return input
    .flatMap((message) =>
      typeof message.content === 'string'
        ? [message.content]
        : message.content.map((part) =>
            typeof part.value === 'string' ? part.value : ''
          )
    )
    .join('\n')
}

export function fakeAi(options: FakeAiOptions = {}): FakeAi {
  const fake: FakeAi = {
    sessions: [],
    inputs: [],
    destroyed: 0,
    provider: {
      name: 'Fake model',
      downloadSize: '1 GB',
      availability: async () => options.availability ?? 'available',
      createSession: async (sessionOptions = {}) => {
        fake.sessions.push(sessionOptions)
        sessionOptions.onDownloadProgress?.(1)
        const answer = (input: AiPromptInput): string => {
          fake.inputs.push(input)
          if (options.error) throw options.error
          const reply = options.reply ?? 'Hello from the fake model'
          return typeof reply === 'function' ? reply(input) : reply
        }
        const session: AiSession = {
          contextUsage: 25,
          contextWindow: 100,
          prompt: async (input) => answer(input),
          async *promptStreaming(input, requestOptions) {
            const text = answer(input)
            const size = options.chunkSize ?? 5
            for (let index = 0; index < text.length; index += size) {
              if (requestOptions?.signal?.aborted)
                throw new DOMException('aborted', 'AbortError')
              await (options.chunkDelay
                ? new Promise((resolve) =>
                    setTimeout(resolve, options.chunkDelay)
                  )
                : Promise.resolve())
              yield text.slice(index, index + size)
            }
          },
          destroy: () => {
            fake.destroyed += 1
          }
        }
        return session
      }
    }
  }
  return fake
}

/** All chat services for a TestBed, without the root component. */
export function provideTestChat(
  config: BrowseAiCoreConfig = {},
  host: HTMLElement = document.createElement('div')
): Provider[] {
  return [
    ...CHAT_INSTANCE_PROVIDERS.slice(1),
    { provide: BAC_HOST_ELEMENT, useValue: host },
    {
      provide: BROWSE_AI_CORE_CONFIG,
      useValue: {
        storage: memoryStorageAdapter(),
        screenCapture: null,
        ...config
      }
    }
  ]
}

export const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))
