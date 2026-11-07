import { AiAvailability, BuiltInToolId } from 'browse-ai-core'
import { GenerationStoppedError, readTextStream } from '../stream-reader'

/** Shape shared by Chrome's task API factories (`Summarizer`, ...). */
export interface TaskApiFactory {
  availability(options?: object): Promise<AiAvailability>
  create(options?: object): Promise<TaskApiInstance>
}

type RunFn = (input: string, options?: object) => Promise<unknown>
type StreamFn = (
  input: string,
  options?: object
) => ReadableStream<unknown> | AsyncIterable<unknown>

export interface TaskApiInstance {
  summarize?: RunFn
  summarizeStreaming?: StreamFn
  translate?: RunFn
  translateStreaming?: StreamFn
  write?: RunFn
  writeStreaming?: StreamFn
  rewrite?: RunFn
  rewriteStreaming?: StreamFn
  proofread?: RunFn
  detect?: (
    input: string
  ) => Promise<{ detectedLanguage: string; confidence: number }[]>
  inputQuota?: number
  measureInputUsage?: (input: string) => Promise<number>
  destroy?: () => void
}

export const API_GLOBALS: Record<BuiltInToolId, string> = {
  summarizer: 'Summarizer',
  translator: 'Translator',
  writer: 'Writer',
  rewriter: 'Rewriter',
  proofreader: 'Proofreader'
}

const METHODS: Record<BuiltInToolId, string> = {
  summarizer: 'summarize',
  translator: 'translate',
  writer: 'write',
  rewriter: 'rewrite',
  proofreader: 'proofread'
}

export function getFactory(name: string): TaskApiFactory | null {
  const value = (globalThis as Record<string, unknown>)[name] as
    Partial<TaskApiFactory> | undefined
  return value && typeof value.create === 'function'
    ? (value as TaskApiFactory)
    : null
}

/** `create()` option that reports download progress from 0 to 1. */
export function downloadMonitor(onProgress: (loaded: number) => void) {
  return (monitor: EventTarget) =>
    monitor.addEventListener('downloadprogress', (event) =>
      onProgress(Number((event as Event & { loaded?: number }).loaded ?? 0))
    )
}

/**
 * Runs one tool on `text`. Streams when the API supports it. The result is
 * only the API's output: Proofreader returns the corrected text.
 */
export async function runTaskApi(
  tool: BuiltInToolId,
  instance: TaskApiInstance,
  text: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (signal.aborted) throw new GenerationStoppedError()
  const method = METHODS[tool] as keyof TaskApiInstance
  const stream = instance[`${method}Streaming` as keyof TaskApiInstance] as
    StreamFn | undefined
  if (stream && tool !== 'proofreader') {
    return readTextStream(
      stream.call(instance, text, { signal }),
      signal,
      onChunk
    )
  }

  const run = instance[method] as RunFn | undefined
  if (!run) throw new Error(`${API_GLOBALS[tool]}.${method} is missing`)
  try {
    const result = await run.call(instance, text, { signal })
    const output =
      tool === 'proofreader'
        ? String((result as { correctedInput?: string }).correctedInput ?? '')
        : String(result ?? '')
    if (output) onChunk(output)
    return output
  } catch (error) {
    if (signal.aborted) throw new GenerationStoppedError()
    throw error
  }
}

/** Whether `text` fits in the instance's input quota (true when unknown). */
export async function fitsInputQuota(
  instance: TaskApiInstance,
  text: string
): Promise<boolean> {
  if (!instance.measureInputUsage || !instance.inputQuota) return true
  try {
    return (await instance.measureInputUsage(text)) <= instance.inputQuota
  } catch {
    return true
  }
}

/** Language of `text`, or `fallback` when LanguageDetector is not ready. */
export async function detectLanguage(
  text: string,
  fallback: string
): Promise<string> {
  const detector = getFactory('LanguageDetector')
  if (!detector) return fallback
  try {
    if ((await detector.availability()) !== 'available') return fallback
    const instance = await detector.create()
    const [top] = (await instance.detect?.(text)) ?? []
    instance.destroy?.()
    return top && top.detectedLanguage !== 'und' && top.confidence >= 0.5
      ? top.detectedLanguage
      : fallback
  } catch {
    return fallback
  }
}
