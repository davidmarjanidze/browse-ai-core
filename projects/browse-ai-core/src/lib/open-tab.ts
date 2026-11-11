/** Message the extension background worker answers by opening a tab. */
export const OPEN_TAB_MESSAGE = 'OPEN_TAB'

export interface OpenTabRequest {
  type: typeof OPEN_TAB_MESSAGE
  url: string
  /** Switch to the new tab. Default false: it opens in the background. */
  active?: boolean
}

export interface OpenTabResponse {
  ok: boolean
  error?: string
}

interface ChromeRuntime {
  id?: string
  lastError?: { message?: string }
  sendMessage(
    message: unknown,
    callback: (response: OpenTabResponse | undefined) => void
  ): void
}

/** Only web addresses can be opened. */
export function isOpenableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Opens `url` in a new tab. In an extension it asks the background worker
 * (`{ type: 'OPEN_TAB', url, active }`), so the pop-up blocker does not apply.
 * On a web page it uses `window.open`, which the browser may block.
 */
export async function openInNewTab(
  url: string,
  active = false
): Promise<'opened' | 'blocked'> {
  if (!isOpenableUrl(url))
    throw new Error('Only http and https links can be opened.')
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } })
    .chrome?.runtime
  if (runtime?.id) {
    const response = await new Promise<OpenTabResponse | undefined>(
      (resolve) => {
        runtime.sendMessage(
          { type: OPEN_TAB_MESSAGE, url, active } satisfies OpenTabRequest,
          (answer) => resolve(runtime.lastError ? undefined : answer)
        )
      }
    )
    if (response?.ok) return 'opened'
  }
  const opened = globalThis.open?.(url, '_blank')
  if (!opened) return 'blocked'
  opened.opener = null
  return 'opened'
}
