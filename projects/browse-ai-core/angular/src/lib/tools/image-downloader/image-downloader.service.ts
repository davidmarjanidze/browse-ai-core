import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import { isGenerationStopped } from '../../ai/stream-reader'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { buildZip } from '../tables/zip'
import { MAX_IMAGES, findVisibleImages, imageFileName } from './visible-images'

export const IMAGES_ZIP_NAME = 'images.zip'

export interface MatchedImage {
  name: string
  blob: Blob
}

export interface ImageSearchResult {
  /** Visible images found on the page (before the limit). */
  total: number
  checked: number
  skipped: number
  matches: MatchedImage[]
  /** More visible images than `MAX_IMAGES`. */
  limited: boolean
  /** The user pressed Stop before all images were checked. */
  stopped: boolean
}

export function buildImageCheckPrompt(request: string): string {
  return [
    'Look at the attached image and decide if it matches the user request.',
    `USER REQUEST: ${request}`,
    'Answer only with JSON: {"match": true} or {"match": false}.'
  ].join('\n')
}

export function parseImageMatch(answer: string): boolean {
  const json = parseJsonFromModelResponse(answer) as { match?: unknown } | null
  if (json && typeof json.match === 'boolean') return json.match
  return /^\W*(true|yes)\b/i.test(answer.trim())
}

/** Checks the visible images one by one and keeps the matching ones. */
@Injectable()
export class ImageDownloaderService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  async find(
    request: string,
    signal: AbortSignal,
    onProgress: (current: number, total: number) => void
  ): Promise<ImageSearchResult> {
    const visible = findVisibleImages(this.#document, this.#host)
    const images = visible.slice(0, MAX_IMAGES)
    const result: ImageSearchResult = {
      total: visible.length,
      checked: 0,
      skipped: 0,
      matches: [],
      limited: visible.length > MAX_IMAGES,
      stopped: false
    }
    const names = new Set<string>()

    for (const [index, image] of images.entries()) {
      if (signal.aborted) break
      onProgress(index + 1, images.length)

      const blob = await this.#load(image.src, signal)
      if (!blob) {
        result.skipped++
        continue
      }
      try {
        const answer = await this.#ai.prompt({
          userPrompt: buildImageCheckPrompt(request),
          agentMode: true,
          imageData: blob,
          withImageInput: true,
          signal,
          track: false
        })
        result.checked++
        if (parseImageMatch(answer)) {
          result.matches.push({
            name: imageFileName(image.src, blob.type, index, names),
            blob
          })
        }
      } catch (error) {
        if (isGenerationStopped(error) || signal.aborted) break
        result.skipped++
      }
    }
    result.stopped = signal.aborted
    return result
  }

  async download(matches: MatchedImage[]): Promise<void> {
    const entries = await Promise.all(
      matches.map(async ({ name, blob }) => ({
        name,
        content: new Uint8Array(await blob.arrayBuffer())
      }))
    )
    const url = URL.createObjectURL(buildZip(entries))
    const anchor = this.#document.createElement('a')
    anchor.href = url
    anchor.download = IMAGES_ZIP_NAME
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async #load(src: string, signal: AbortSignal): Promise<Blob | null> {
    try {
      const response = await fetch(src, { signal })
      if (!response.ok) return null
      const blob = await response.blob()
      return blob.type.startsWith('image/') ? blob : null
    } catch {
      return null
    }
  }
}
