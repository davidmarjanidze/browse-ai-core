const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA'])

interface TextIndex {
  /** Page text without any whitespace. */
  text: string
  /** For each character of `text`, where it is in the page. */
  positions: { node: Text; offset: number }[]
}

const stripSpaces = (value: string): string => value.replace(/\s+/gu, '')

/**
 * Indexes the text under `root`, leaving out `skip` (the chat) and scripts.
 * Whitespace is left out, because selections and `textContent` differ in
 * how they report spaces and line breaks.
 */
export function indexText(root: Node, skip?: Node | null): TextIndex {
  const doc = root.ownerDocument ?? (root as Document)
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent || SKIPPED.has(parent.tagName))
        return NodeFilter.FILTER_REJECT
      if (skip && skip.contains(node)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let text = ''
  const positions: TextIndex['positions'] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data
    for (let offset = 0; offset < data.length; offset++) {
      const char = data[offset]
      if (/\s/u.test(char)) continue
      text += char
      positions.push({ node: node as Text, offset })
    }
  }
  return { text, positions }
}

/**
 * Finds `quote` on the page and returns it as a Range. The text right before
 * and after the quote is used first, so the right copy is found when the
 * quote appears more than once. Returns null when it is not found.
 */
export function findTextRange(
  doc: Document,
  quote: string,
  before = '',
  after = '',
  skip?: Node | null
): Range | null {
  const target = stripSpaces(quote)
  if (!target || !doc.body) return null
  const index = indexText(doc.body, skip)

  let start = -1
  const prefix = stripSpaces(before)
  const withContext = index.text.indexOf(prefix + target + stripSpaces(after))
  if (withContext >= 0) start = withContext + prefix.length
  if (start < 0) start = index.text.indexOf(target)
  if (start < 0) return null

  const first = index.positions[start]
  const last = index.positions[start + target.length - 1]
  const range = doc.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}

/** Up to `size` characters of page text right before and after a range. */
export function textAround(
  range: Range,
  size = 32
): { before: string; after: string } {
  const doc = range.startContainer.ownerDocument
  if (!doc?.body) return { before: '', after: '' }
  const beforeRange = doc.createRange()
  beforeRange.setStart(doc.body, 0)
  beforeRange.setEnd(range.startContainer, range.startOffset)
  const afterRange = doc.createRange()
  afterRange.setStart(range.endContainer, range.endOffset)
  afterRange.setEndAfter(doc.body.lastChild ?? doc.body)
  return {
    before: beforeRange.toString().slice(-size),
    after: afterRange.toString().slice(0, size)
  }
}
