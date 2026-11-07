/** Smallest rendered width and height of an image worth checking. */
export const MIN_IMAGE_SIZE = 48
/** Most images checked in one run. */
export const MAX_IMAGES = 50

export interface VisibleImage {
  src: string
  element: HTMLImageElement
}

/**
 * Loaded `<img>` elements at least partly inside the viewport and at least
 * `MIN_IMAGE_SIZE` px in both directions, without duplicates and without the
 * chat's own images. In page order.
 */
export function findVisibleImages(
  doc: Document,
  host: HTMLElement
): VisibleImage[] {
  const view = doc.defaultView
  const width = view?.innerWidth ?? 0
  const height = view?.innerHeight ?? 0
  const seen = new Set<string>()
  const images: VisibleImage[] = []

  for (const element of Array.from(doc.images)) {
    if (host.contains(element)) continue
    const src = element.currentSrc || element.src
    if (!src || seen.has(src)) continue
    if (!element.complete || element.naturalWidth === 0) continue

    const rect = element.getBoundingClientRect()
    if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) continue
    const inView =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < height &&
      rect.left < width
    if (!inView) continue

    seen.add(src)
    images.push({ src, element })
  }
  return images
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp'
}

/** File name from the URL, with the right extension, unique in `used`. */
export function imageFileName(
  src: string,
  type: string,
  index: number,
  used: Set<string>
): string {
  let base = ''
  try {
    const url = new URL(src)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      base = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    }
  } catch {
    base = ''
  }
  base = base.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-')
  if (!base) base = `image-${index + 1}`
  const extension = EXTENSIONS[type] ?? 'img'

  let name = `${base}.${extension}`
  for (let n = 2; used.has(name); n++) name = `${base}-${n}.${extension}`
  used.add(name)
  return name
}
