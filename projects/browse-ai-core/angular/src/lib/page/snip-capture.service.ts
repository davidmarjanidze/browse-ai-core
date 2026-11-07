import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { ConfigStore } from '../core/config.store'
import { BAC_HOST_ELEMENT } from '../core/host-element'
import { cropScreenshot, selectRegion } from './region-selector'

const nextPaint = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )

/** Screenshots of the page, with the chat hidden while capturing. */
@Injectable()
export class SnipCaptureService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #configStore = inject(ConfigStore)
  #isCapturing = false

  get isAvailable(): boolean {
    return this.#configStore.config().screenCapture !== null
  }

  captureVisibleArea(): Promise<string> {
    return this.#run(() => this.#capture())
  }

  captureRegion(): Promise<string> {
    return this.#run(async () => {
      const color =
        getComputedStyle(this.#host).getPropertyValue('--bac-primary').trim() ||
        '#38bdf8'
      const rect = await selectRegion(this.#document, {
        hint: this.#configStore.strings().snipHint,
        color
      })
      await nextPaint()
      const view = this.#document.defaultView ?? window
      return cropScreenshot(await this.#capture(), rect, {
        width: view.innerWidth,
        height: view.innerHeight
      })
    })
  }

  #capture(): Promise<string> {
    const adapter = this.#configStore.config().screenCapture
    if (!adapter) {
      return Promise.reject(
        new Error(this.#configStore.strings().captureUnavailable)
      )
    }
    return adapter.captureVisibleArea()
  }

  async #run(operation: () => Promise<string>): Promise<string> {
    if (this.#isCapturing) {
      throw new Error('A screenshot is already being taken.')
    }
    this.#isCapturing = true
    const previousVisibility = this.#host.style.visibility
    this.#host.style.visibility = 'hidden'

    try {
      await nextPaint()
      return await operation()
    } finally {
      this.#host.style.visibility = previousVisibility
      this.#isCapturing = false
    }
  }
}
