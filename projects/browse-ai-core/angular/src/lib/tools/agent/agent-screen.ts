import { MarkerLayer } from '../../page/marker-layer'
import type { RefMap } from './page-snapshot'

/** Widest screenshot sent to the model, in px. */
export const MAX_SCREENSHOT_WIDTH = 1024
/** Most number badges drawn on one screenshot. */
const MAX_BADGES = 80

/**
 * Draws a numbered badge on every listed element in view, runs `capture`,
 * then removes the badges. The model can match what it sees to refs.
 */
export async function captureWithRefs(
  doc: Document,
  host: HTMLElement,
  refs: RefMap,
  capture: () => Promise<string>
): Promise<string> {
  const height = doc.defaultView?.innerHeight ?? 800
  const inView = refs
    .entries()
    .filter(([, element]) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < height && rect.width > 0
    })
    .slice(0, MAX_BADGES)
  const layer = new MarkerLayer({ doc, themeSource: host })
  try {
    layer.show(
      inView.map(([ref, element]) => ({
        id: String(ref),
        element,
        badge: String(ref),
        title: '',
        text: ''
      }))
    )
    return await capture()
  } finally {
    layer.destroy()
  }
}

/** Scales a data URL image down to `maxWidth` and returns it as a Blob. */
export async function shrinkImage(
  dataUrl: string,
  maxWidth = MAX_SCREENSHOT_WIDTH
): Promise<Blob> {
  const original = await (await fetch(dataUrl)).blob()
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas !== 'function'
  )
    return original
  try {
    const bitmap = await createImageBitmap(original)
    if (bitmap.width <= maxWidth) return original
    const scale = maxWidth / bitmap.width
    const canvas = new OffscreenCanvas(
      maxWidth,
      Math.round(bitmap.height * scale)
    )
    canvas
      .getContext('2d')
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvas.convertToBlob({ type: 'image/png' })
  } catch {
    return original
  }
}

/** Outlines an element for a moment so the user sees what the agent touched. */
export function flashElement(
  doc: Document,
  element: Element,
  color: string,
  ms = 1000
): void {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return
  const box = doc.createElement('div')
  box.setAttribute('data-browse-ai-core-flash', '')
  box.style.cssText = `pointer-events:none;position:fixed;z-index:2147483646;box-sizing:border-box;border:3px solid ${color};border-radius:4px;left:${rect.left - 3}px;top:${rect.top - 3}px;width:${rect.width + 6}px;height:${rect.height + 6}px;`
  doc.documentElement.appendChild(box)
  setTimeout(() => box.remove(), ms)
}
