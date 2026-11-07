/**
 * Takes a screenshot of the visible part of the page, used by "Capture visible
 * area" and "Snip & capture". Returns a PNG data URL.
 */
export interface ScreenCaptureAdapter {
  captureVisibleArea(): Promise<string>
}

/** Message the extension background worker answers with a screenshot. */
export const CAPTURE_VISIBLE_TAB_MESSAGE = 'CAPTURE_VISIBLE_TAB'

export interface CaptureVisibleTabResponse {
  ok: boolean
  dataUrl?: string
  error?: string
}

interface ChromeRuntime {
  id?: string
  lastError?: { message?: string }
  sendMessage(
    message: unknown,
    callback: (response: CaptureVisibleTabResponse | undefined) => void
  ): void
}

function getChromeRuntime(): ChromeRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } })
    .chrome?.runtime
  return runtime?.id ? runtime : null
}

/**
 * For browser extensions. Sends `{ type: 'CAPTURE_VISIBLE_TAB' }` to the
 * background worker, which should answer with `chrome.tabs.captureVisibleTab`.
 * Returns `null` outside an extension.
 */
export function chromeExtensionScreenCapture(): ScreenCaptureAdapter | null {
  const runtime = getChromeRuntime()
  if (!runtime) return null

  return {
    captureVisibleArea() {
      return new Promise<string>((resolve, reject) => {
        runtime.sendMessage(
          { type: CAPTURE_VISIBLE_TAB_MESSAGE },
          (response) => {
            const runtimeError = runtime.lastError
            if (runtimeError) {
              reject(new Error(runtimeError.message))
              return
            }
            if (!response?.ok || !response.dataUrl) {
              reject(
                new Error(
                  response?.error || 'Unable to capture the current tab.'
                )
              )
              return
            }
            resolve(response.dataUrl)
          }
        )
      })
    }
  }
}

/**
 * For web pages. Uses `getDisplayMedia`, so the browser asks the user to
 * share the current tab. Returns `null` when screen sharing is not supported.
 */
export function displayMediaScreenCapture(): ScreenCaptureAdapter | null {
  const mediaDevices = globalThis.navigator?.mediaDevices
  if (!mediaDevices?.getDisplayMedia) return null

  return {
    async captureVisibleArea() {
      const stream = await mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true
      } as DisplayMediaStreamOptions)

      try {
        const video = document.createElement('video')
        video.muted = true
        video.srcObject = stream
        await video.play()

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Could not prepare screenshot canvas.')

        context.drawImage(video, 0, 0)
        return canvas.toDataURL('image/png')
      } finally {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }
}

/** The extension adapter inside an extension, otherwise screen sharing. */
export function defaultScreenCapture(): ScreenCaptureAdapter | null {
  return chromeExtensionScreenCapture() ?? displayMediaScreenCapture()
}
