import { isOffLimits, nameOf, walkElements } from './page-snapshot'
import { matchesRiskWords } from './risk-check'

/** Share of the viewport a fixed box must cover to count as a pop-up. */
const MIN_COVER = 0.3

const DIALOGS =
  'dialog[open], [role=dialog], [role=alertdialog], [aria-modal=true]'
const BUTTONS =
  'button, [role=button], a, input[type=button], input[type=submit]'

/** Button names that close or decline, best first. */
const CLOSE_WORDS = [
  'reject all',
  'reject',
  'decline',
  'necessary only',
  'only necessary',
  'essential only',
  'no thanks',
  'not now',
  'maybe later',
  'dismiss',
  'close',
  'cancel'
]
const CLOSE_SIGNS = ['×', '✕', '✖', 'x']

/** Button names that would agree to something for the user. */
const NEVER_WORDS = [
  'accept',
  'agree',
  'allow',
  'subscribe',
  'sign up',
  'signup',
  'register',
  'buy',
  'continue',
  'ok',
  'yes',
  'got it'
]

function isHidden(element: Element): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  if (style?.display === 'none' || style?.visibility === 'hidden') return true
  const rect = element.getBoundingClientRect()
  return rect.width === 0 && rect.height === 0
}

/** True when the button would agree, pay or send something. */
export function isAgreeButton(
  button: Element,
  riskWords: readonly string[]
): boolean {
  const name = nameOf(button)
  return (
    matchesRiskWords(name, NEVER_WORDS) || matchesRiskWords(name, riskWords)
  )
}

/** The best close or decline button, or null. Never an agree button. */
export function closeButtonOf(
  overlay: Element,
  riskWords: readonly string[],
  isSafe: (button: Element) => boolean = () => true
): Element | null {
  const buttons = [...overlay.querySelectorAll(BUTTONS)].filter(
    (button) =>
      !isHidden(button) && !isAgreeButton(button, riskWords) && isSafe(button)
  )
  const names = buttons.map((button) => nameOf(button).trim().toLowerCase())
  for (const word of CLOSE_WORDS) {
    const index = names.findIndex((name) => matchesRiskWords(name, [word]))
    if (index >= 0) return buttons[index]
  }
  const index = names.findIndex((name) => CLOSE_SIGNS.includes(name))
  return index >= 0 ? buttons[index] : null
}

function zIndexOf(element: Element): number {
  const value = Number(
    element.ownerDocument.defaultView?.getComputedStyle(element).zIndex
  )
  return Number.isFinite(value) ? value : 0
}

/** A fixed or sticky box over a big part of the screen, or a full-width bar. */
function isCoveringBox(
  element: Element,
  riskWords: readonly string[]
): boolean {
  const view = element.ownerDocument.defaultView
  const position = view?.getComputedStyle(element).position
  if (position !== 'fixed' && position !== 'sticky') return false
  const width = view?.innerWidth ?? 1024
  const height = view?.innerHeight ?? 800
  const rect = element.getBoundingClientRect()
  const visible =
    Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0)) *
    Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0))
  if (visible >= width * height * MIN_COVER) return true
  const bar =
    rect.width >= width * 0.9 && (rect.top <= 1 || rect.bottom >= height - 1)
  // Headers are bars too, so a bar only counts with a close button.
  return bar && closeButtonOf(element, riskWords) !== null
}

/** The topmost pop-up on the page, or null. */
export function findOverlay(
  doc: Document,
  host: Element | null,
  riskWords: readonly string[]
): Element | null {
  let best: Element | null = null
  let bestZ = -Infinity
  for (const element of walkElements(doc)) {
    if (isOffLimits(element, host)) continue
    const isDialog = element.matches(DIALOGS)
    if (!isDialog && !isCoveringBox(element, riskWords)) continue
    if (isHidden(element)) continue
    // Keep the outermost match: a dialog inside a fixed box is the same pop-up.
    if (best?.contains(element)) continue
    const z = zIndexOf(element)
    if (z >= bestZ) {
      best = element
      bestZ = z
    }
  }
  return best
}

/** True when the pop-up was removed or hidden. */
export const isGone = (overlay: Element): boolean =>
  !overlay.isConnected ||
  isHidden(overlay) ||
  (overlay instanceof HTMLDialogElement && !overlay.open)
