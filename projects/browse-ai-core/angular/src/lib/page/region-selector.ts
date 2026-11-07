export const SNIP_CANCELED = 'SNIP_CANCELED'

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface RegionSelectorOptions {
  hint: string
  /** Border and fill color of the selection box. */
  color: string
}

const MIN_SIZE = 8

export function rectFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): SelectionRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  }
}

/**
 * Covers the page with an overlay and lets the user drag a rectangle.
 * Rejects with `SNIP_CANCELED` on Esc or a tiny selection.
 */
export function selectRegion(
  doc: Document,
  options: RegionSelectorOptions
): Promise<SelectionRect> {
  return new Promise((resolve, reject) => {
    const view = doc.defaultView ?? window
    const overlay = doc.createElement('div')
    overlay.setAttribute('data-browse-ai-core-snip', '')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;user-select:none;touch-action:none;background:rgba(0,0,0,0.35);'

    const hint = doc.createElement('div')
    hint.textContent = options.hint
    hint.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:999px;background:rgba(0,0,0,0.75);color:#fff;font:12px system-ui,sans-serif;pointer-events:none;'

    const box = doc.createElement('div')
    box.style.cssText = `position:absolute;display:none;pointer-events:none;border:2px dashed ${options.color};background:color-mix(in srgb, ${options.color} 20%, transparent);`

    overlay.append(hint, box)
    doc.documentElement.appendChild(overlay)

    let start: { x: number; y: number } | null = null

    const cleanup = (): void => {
      view.removeEventListener('pointerdown', onDown, true)
      view.removeEventListener('pointermove', onMove, true)
      view.removeEventListener('pointerup', onUp, true)
      view.removeEventListener('keydown', onKey, true)
      overlay.remove()
    }

    const draw = (rect: SelectionRect): void => {
      Object.assign(box.style, {
        display: 'block',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      })
    }

    const onDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      event.preventDefault()
      start = { x: event.clientX, y: event.clientY }
      draw(rectFromPoints(start.x, start.y, start.x, start.y))
    }

    const onMove = (event: PointerEvent): void => {
      if (!start) return
      event.preventDefault()
      draw(rectFromPoints(start.x, start.y, event.clientX, event.clientY))
    }

    const onUp = (event: PointerEvent): void => {
      if (!start) return
      event.preventDefault()
      const rect = rectFromPoints(
        start.x,
        start.y,
        event.clientX,
        event.clientY
      )
      start = null
      cleanup()

      if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
        reject(new Error(SNIP_CANCELED))
      } else {
        resolve(rect)
      }
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cleanup()
      reject(new Error(SNIP_CANCELED))
    }

    view.addEventListener('pointerdown', onDown, true)
    view.addEventListener('pointermove', onMove, true)
    view.addEventListener('pointerup', onUp, true)
    view.addEventListener('keydown', onKey, true)
  })
}

/** Crops a screenshot (taken of the whole viewport) to `rect`. */
export async function cropScreenshot(
  dataUrl: string,
  rect: SelectionRect,
  viewport: { width: number; height: number }
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error('Captured screenshot could not be decoded.'))
    img.src = dataUrl
  })

  const scaleX = image.naturalWidth / viewport.width
  const scaleY = image.naturalHeight / viewport.height
  const sx = Math.max(0, Math.floor(rect.x * scaleX))
  const sy = Math.max(0, Math.floor(rect.y * scaleY))
  const width = Math.max(
    1,
    Math.min(Math.floor(rect.width * scaleX), image.naturalWidth - sx)
  )
  const height = Math.max(
    1,
    Math.min(Math.floor(rect.height * scaleY), image.naturalHeight - sy)
  )

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare screenshot canvas.')

  context.drawImage(image, sx, sy, width, height, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
