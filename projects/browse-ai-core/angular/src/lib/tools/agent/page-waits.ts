import { GenerationStoppedError } from '../../ai/stream-reader'

/** How often `waitFor` checks besides DOM changes, in ms. */
export const POLL_MS = 250
/** Quiet time that counts as idle, in ms. */
export const IDLE_MS = 500

function stopped(): GenerationStoppedError {
  return new GenerationStoppedError()
}

/** Waits `ms` milliseconds. Rejects right away when `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(stopped())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(stopped())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export type WaitForResult = 'appeared' | 'disappeared' | 'timeout'

export interface WaitForOptions {
  doc: Document
  /** True when the thing being waited for is on the page. */
  check: () => boolean
  /** `visible`: wait until `check` is true. `hidden`: until it is false. */
  state: 'visible' | 'hidden'
  timeoutMs: number
  signal?: AbortSignal
}

/**
 * Checks on every DOM change and every `POLL_MS` (for changes the observer
 * misses, such as styles), until the state is reached or time runs out.
 */
export function waitFor(options: WaitForOptions): Promise<WaitForResult> {
  const { doc, check, state, timeoutMs, signal } = options
  const done = (): boolean => check() === (state === 'visible')
  const success: WaitForResult =
    state === 'visible' ? 'appeared' : 'disappeared'
  if (signal?.aborted) return Promise.reject(stopped())
  if (done()) return Promise.resolve(success)

  return new Promise((resolve, reject) => {
    const view = doc.defaultView
    const observer = view?.MutationObserver
      ? new view.MutationObserver(() => test())
      : null
    const poll = setInterval(() => test(), POLL_MS)
    const timer = setTimeout(() => finish(() => resolve('timeout')), timeoutMs)
    const onAbort = (): void => finish(() => reject(stopped()))

    function finish(action: () => void): void {
      observer?.disconnect()
      clearInterval(poll)
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      action()
    }
    function test(): void {
      if (done()) finish(() => resolve(success))
    }

    observer?.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Resolves `idle` once the page has had no DOM changes and no new network
 * requests for `IDLE_MS`, or `timeout` after `timeoutMs`. With a shorter
 * `firstQuietMs`, a page that stays quiet from the start counts as idle
 * sooner; after any change the full `IDLE_MS` applies.
 */
export function waitForIdle(
  doc: Document,
  timeoutMs: number,
  signal?: AbortSignal,
  firstQuietMs = IDLE_MS
): Promise<'idle' | 'timeout'> {
  if (signal?.aborted) return Promise.reject(stopped())
  return new Promise((resolve, reject) => {
    const view = doc.defaultView
    let quietTimer = setTimeout(
      () => finish(() => resolve('idle')),
      firstQuietMs
    )
    const bump = (): void => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(() => finish(() => resolve('idle')), IDLE_MS)
    }
    const observer = view?.MutationObserver
      ? new view.MutationObserver(bump)
      : null
    let network: PerformanceObserver | null = null
    try {
      const Observer = (
        view as { PerformanceObserver?: typeof PerformanceObserver } | null
      )?.PerformanceObserver
      if (Observer) {
        network = new Observer(bump)
        network.observe({ type: 'resource', buffered: false })
      }
    } catch {
      network = null
    }
    const timer = setTimeout(() => finish(() => resolve('timeout')), timeoutMs)
    const onAbort = (): void => finish(() => reject(stopped()))

    function finish(action: () => void): void {
      observer?.disconnect()
      network?.disconnect()
      clearTimeout(quietTimer)
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      action()
    }

    observer?.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
