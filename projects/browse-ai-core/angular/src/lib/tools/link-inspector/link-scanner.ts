export type LinkGroup =
  'internal' | 'external' | 'download' | 'contact' | 'suspicious'

export const LINK_GROUPS: readonly LinkGroup[] = [
  'internal',
  'external',
  'download',
  'contact',
  'suspicious'
]

export interface LinkRow {
  id: number
  url: string
  text: string
  group: LinkGroup
  /** How many times the URL appears on the page. */
  count: number
  reason?: string
}

export interface ScannedLinks {
  rows: LinkRow[]
  /** Elements for each row id, to scroll to them. */
  elements: Map<number, Element[]>
}

const DOWNLOAD_EXTENSIONS =
  /\.(pdf|zip|rar|7z|gz|tar|csv|xlsx?|docx?|pptx?|odt|ods|dmg|exe|msi|pkg|deb|rpm|apk|iso|mp3|mp4|mov|epub)$/iu

/** A domain written as the visible text, like "paypal.com". */
const DOMAIN_TEXT =
  /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[/?#].*)?$/iu

export function stripWww(hostname: string): string {
  return hostname.replace(/^www\./iu, '').toLowerCase()
}

function isHidden(element: Element): boolean {
  if ((element as HTMLElement).hidden) return true
  const view = element.ownerDocument.defaultView
  const style = view?.getComputedStyle(element)
  if (style && (style.display === 'none' || style.visibility === 'hidden'))
    return true
  // jsdom has no layout, so only real browsers report zero size.
  const rect = element.getBoundingClientRect()
  const hasLayout =
    typeof navigator !== 'undefined' && !/jsdom/iu.test(navigator.userAgent)
  return hasLayout && rect.width === 0 && rect.height === 0
}

function linkText(element: Element): string {
  const text =
    element.textContent?.replace(/\s+/gu, ' ').trim() ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.querySelector('img')?.getAttribute('alt') ||
    ''
  return text.slice(0, 120)
}

/** The group for one link. Exported for tests. */
export function classifyLink(
  rawHref: string,
  url: URL | null,
  text: string,
  pageHost: string,
  hasDownloadAttr: boolean
): LinkGroup {
  const href = rawHref.trim()
  if (!href || href === '#' || /^javascript:/iu.test(href) || !url)
    return 'suspicious'
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return 'contact'
  const shownDomain = text.match(DOMAIN_TEXT)?.[1]
  if (shownDomain && stripWww(shownDomain) !== stripWww(url.hostname))
    return 'suspicious'
  if (hasDownloadAttr || DOWNLOAD_EXTENSIONS.test(url.pathname))
    return 'download'
  return stripWww(url.hostname) === stripWww(pageHost) ? 'internal' : 'external'
}

/** Visible links on the page, merged by URL, outside the chat host. */
export function scanLinks(doc: Document, host?: Element | null): ScannedLinks {
  const pageHost = doc.location?.hostname ?? ''
  const byUrl = new Map<string, LinkRow>()
  const elements = new Map<number, Element[]>()

  for (const element of Array.from(
    doc.querySelectorAll('a[href], area[href]')
  )) {
    if (host && (host === element || host.contains(element))) continue
    if (isHidden(element)) continue
    const href = element.getAttribute('href') ?? ''
    let url: URL | null = null
    try {
      url = /^javascript:/iu.test(href.trim())
        ? null
        : new URL(href, doc.baseURI)
    } catch {
      url = null
    }
    const text = linkText(element)
    const group = classifyLink(
      href,
      url,
      text,
      pageHost,
      element.hasAttribute('download')
    )
    const key = group === 'suspicious' ? `${href}|${text}` : (url?.href ?? href)
    const existing = byUrl.get(key)
    if (existing) {
      existing.count += 1
      elements.get(existing.id)?.push(element)
      continue
    }
    const row: LinkRow = {
      id: byUrl.size,
      url: url?.href ?? href,
      text,
      group,
      count: 1
    }
    byUrl.set(key, row)
    elements.set(row.id, [element])
  }
  return { rows: [...byUrl.values()], elements }
}
