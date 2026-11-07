import { AiSession } from 'browse-ai-core'
import {
  isGenerationStopped,
  isQuotaExceededError,
  readResponse
} from './stream-reader'

const streamOf = (chunks: unknown[]): AiSession => ({
  prompt: async () => '',
  promptStreaming: () =>
    new ReadableStream<string>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk as string))
        controller.close()
      }
    })
})

describe('readResponse', () => {
  it('joins chunks from a ReadableStream', async () => {
    const chunks: string[] = []
    const text = await readResponse(
      streamOf(['He', { text: 'llo' }, '']),
      'hi',
      undefined,
      (c) => chunks.push(c)
    )
    expect(text).toBe('Hello')
    expect(chunks).toEqual(['He', 'llo'])
  })

  it('joins chunks from an async iterable', async () => {
    const session: AiSession = {
      prompt: async () => '',
      async *promptStreaming() {
        yield 'a'
        yield 'b'
      }
    }
    expect(await readResponse(session, 'hi')).toBe('ab')
  })

  it('uses prompt() when streaming is not supported', async () => {
    const session: AiSession = { prompt: async () => 'full' }
    const onChunk = vi.fn()
    expect(await readResponse(session, 'hi', undefined, onChunk)).toBe('full')
    expect(onChunk).toHaveBeenCalledWith('full')
  })

  it('throws a stop error when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await readResponse(
      streamOf(['a']),
      'hi',
      controller.signal
    ).catch((e) => e)
    expect(isGenerationStopped(error)).toBe(true)
  })

  it('detects quota errors', () => {
    expect(
      isQuotaExceededError(new DOMException('x', 'QuotaExceededError'))
    ).toBe(true)
    expect(isQuotaExceededError(new Error('The input is too large'))).toBe(true)
    expect(isQuotaExceededError(new Error('other'))).toBe(false)
  })
})
