import type { AgentConfirmMode } from 'browse-ai-core'
import { nameOf } from './page-snapshot'

export type RiskReason = 'submit' | 'words' | 'navigate' | 'always' | null

/** True when the link would load another page (not a hash or script link). */
export function isNavigatingLink(element: Element, doc: Document): boolean {
  const link = element.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return false
  const href = link.getAttribute('href') ?? ''
  if (
    !href ||
    href.startsWith('#') ||
    href.toLowerCase().startsWith('javascript:')
  )
    return false
  try {
    const url = new URL(link.href, doc.baseURI)
    const here = new URL(doc.location?.href ?? doc.baseURI)
    return !(
      url.origin === here.origin &&
      url.pathname === here.pathname &&
      url.search === here.search
    )
  } catch {
    return true
  }
}

function isSubmitButton(element: Element): boolean {
  const button = element.closest(
    'button, input[type=submit], input[type=image]'
  )
  if (!button) return false
  if (button instanceof HTMLButtonElement)
    return (
      (button.getAttribute('type') ?? 'submit').toLowerCase() === 'submit' &&
      button.form !== null
    )
  return (button as HTMLInputElement).form !== null
}

export function matchesRiskWords(
  text: string,
  words: readonly string[]
): boolean {
  const lower = text.toLowerCase()
  return words.some((word) =>
    new RegExp(
      `(^|\\W)${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(\\W|$)`,
      'u'
    ).test(lower)
  )
}

/**
 * Why an action needs the user's OK, or null. `action` is the tool name.
 * The caller passes `press_key` only for Enter and `type_text` only when it
 * submits.
 */
export function riskOf(
  action: string,
  element: Element | null,
  doc: Document,
  mode: AgentConfirmMode,
  words: readonly string[]
): RiskReason {
  const changes = [
    'click',
    'type_text',
    'press_key',
    'select_option',
    'set_checked',
    'go_back'
  ].includes(action)
  if (!changes) return null
  if (action === 'go_back') return mode === 'never' ? null : 'navigate'
  if (mode === 'never') return null
  if (mode === 'always') return 'always'
  if (!element) return null

  const clicks = action === 'click' || action === 'set_checked'
  if (clicks && isNavigatingLink(element, doc)) return 'navigate'
  if (clicks && isSubmitButton(element)) return 'submit'
  if (action === 'press_key' || action === 'type_text') {
    // Only Enter (or type_text with submit) can send a form.
    return element instanceof HTMLInputElement && element.form ? 'submit' : null
  }
  if (clicks && matchesRiskWords(nameOf(element), words)) return 'words'
  return null
}
