import { isSensitiveField } from '../../page/insert-text'

/** Most characters of an element's text that are watched. */
export const MAX_WATCHED_CHARS = 4_000

/**
 * The text a user would read in the element: visible text, values of form
 * fields (not passwords or cards), and ARIA values. Whitespace is collapsed.
 */
export function readWatchedText(element: Element): string {
  const parts: string[] = []
  const html = element as HTMLElement
  const visible =
    typeof html.innerText === 'string' && html.innerText !== ''
      ? html.innerText
      : (element.textContent ?? '')
  parts.push(visible)

  const fields = [
    element,
    ...element.querySelectorAll('input, select, textarea')
  ]
  for (const field of fields) {
    if (isSensitiveField(field)) continue
    if (field instanceof HTMLSelectElement)
      parts.push(field.selectedOptions[0]?.textContent ?? '')
    else if (field instanceof HTMLTextAreaElement) parts.push(field.value)
    else if (
      field instanceof HTMLInputElement &&
      !['checkbox', 'radio', 'hidden', 'file'].includes(field.type)
    )
      parts.push(field.value)
    else if (
      field instanceof HTMLInputElement &&
      (field.type === 'checkbox' || field.type === 'radio')
    )
      parts.push(field.checked ? '[checked]' : '[unchecked]')
  }
  for (const attribute of ['aria-valuetext', 'aria-valuenow']) {
    const value = element.getAttribute(attribute)
    if (value) {
      parts.push(value)
      break
    }
  }
  const text = parts.join(' ').replace(/\s+/gu, ' ').trim()
  if (!text) return (element.getAttribute('aria-label') ?? '').trim()
  return text
}

export function capText(text: string, max = MAX_WATCHED_CHARS): string {
  return text.length > max ? text.slice(0, max) : text
}

/** Lines are split on sentence ends and line breaks so short texts still diff well. */
function lines(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+|\s{2,}/u)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Removed (`-`) and added (`+`) lines between two texts, cut to `max` chars. */
export function diffLines(before: string, after: string, max = 1_000): string {
  const old = lines(before)
  const now = lines(after)
  const oldSet = new Set(old)
  const nowSet = new Set(now)
  const out = [
    ...old.filter((line) => !nowSet.has(line)).map((line) => `- ${line}`),
    ...now.filter((line) => !oldSet.has(line)).map((line) => `+ ${line}`)
  ]
  if (!out.length && before !== after)
    out.push(`- ${before.slice(0, 200)}`, `+ ${after.slice(0, 200)}`)
  const joined = out.join('\n')
  return joined.length > max ? `${joined.slice(0, max)}…` : joined
}

/**
 * Numbers in the text, read with the page language's separators. `1,234.50`
 * in English and `1.234,50` in German both give 1234.5.
 */
export function extractNumbers(text: string, lang = 'en', max = 20): number[] {
  const decimalComma = (() => {
    try {
      return new Intl.NumberFormat(lang).format(1.5).includes(',')
    } catch {
      return false
    }
  })()
  const matches = text.match(/[-−]?\d[\d.,\s  ']*\d|[-−]?\d/gu) ?? []
  const numbers: number[] = []
  for (const raw of matches) {
    let value = raw.replace(/[\s  ']/gu, '').replace('−', '-')
    if (decimalComma) value = value.replace(/\./gu, '').replace(',', '.')
    else value = value.replace(/,/gu, '')
    const number = Number(value)
    if (Number.isFinite(number)) numbers.push(number)
    if (numbers.length >= max) break
  }
  return numbers
}
