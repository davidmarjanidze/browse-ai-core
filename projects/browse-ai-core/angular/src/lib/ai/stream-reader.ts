import { AiPromptInput, AiSession } from 'browse-ai-core'

export const GENERATION_STOPPED = 'GENERATION_STOPPED'

export class GenerationStoppedError extends Error {
  constructor(message = 'Response generation was stopped.') {
    super(message)
    this.name = GENERATION_STOPPED
  }
}

export function isGenerationStopped(error: unknown): boolean {
  return error instanceof Error && error.name === GENERATION_STOPPED
}

function chunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk
  if (chunk && typeof chunk === 'object') {
    const value = chunk as { text?: unknown; value?: unknown }
    if (typeof value.text === 'string') return value.text
    if (typeof value.value === 'string') return value.value
  }
  return ''
}

async function* iterate(
  stream: ReadableStream<unknown> | AsyncIterable<unknown>
): AsyncGenerator<unknown> {
  if ('getReader' in stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) return
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
  yield* stream as AsyncIterable<unknown>
}

/**
 * Sends `input` to the session and returns the full answer. Calls `onChunk`
 * with every new piece of text while it streams.
 */
export async function readResponse(
  session: AiSession,
  input: AiPromptInput,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (signal?.aborted) throw new GenerationStoppedError()

  if (!session.promptStreaming) {
    const result = await session.prompt(input, { signal })
    if (result) onChunk?.(result)
    return result
  }

  return readTextStream(
    session.promptStreaming(input, { signal }),
    signal,
    onChunk
  )
}

/**
 * Reads a stream of text pieces (each chunk is new text) into one string.
 * Throws `GenerationStoppedError` when `signal` aborts.
 */
export async function readTextStream(
  stream: ReadableStream<unknown> | AsyncIterable<unknown>,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<string> {
  let output = ''
  try {
    for await (const chunk of iterate(stream)) {
      if (signal?.aborted) throw new GenerationStoppedError()
      const text = chunkText(chunk)
      if (!text) continue
      output += text
      onChunk?.(text)
    }
  } catch (error) {
    if (signal?.aborted) throw new GenerationStoppedError()
    throw error
  }
  return output
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error) && !(error instanceof DOMException))
    return false
  return (
    error.name === 'QuotaExceededError' ||
    /QuotaExceededError|input is too large/i.test(error.message)
  )
}
