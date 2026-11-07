export interface PageContextInfo {
  title: string
  url: string
  domain: string
  description: string
  mainText: string
  headings: string[]
  wordCount: number
  selectedText?: string
  extractedAt: Date
}

export function emptyPageContext(): PageContextInfo {
  return {
    title: '',
    url: '',
    domain: '',
    description: '',
    mainText: '',
    headings: [],
    wordCount: 0,
    extractedAt: new Date()
  }
}

/** Reads title, description, headings and text from a document. */
export function extractPageContext(
  doc: Document,
  selectedText = ''
): PageContextInfo {
  const url = doc.location?.href || ''
  let domain = ''
  try {
    domain = new URL(url).hostname
  } catch {
    domain = ''
  }

  const meta =
    doc.querySelector('meta[name="description"]') ??
    doc.querySelector('meta[property="og:description"]')
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
    .map((heading) => heading.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 15)
  const body = doc.body as HTMLElement | null
  const mainText = (body?.innerText ?? body?.textContent ?? '').trim()

  return {
    title: doc.title || '',
    url,
    domain,
    description: meta?.getAttribute('content') ?? '',
    mainText,
    headings,
    wordCount: mainText.split(/\s+/).filter(Boolean).length,
    selectedText,
    extractedAt: new Date()
  }
}
