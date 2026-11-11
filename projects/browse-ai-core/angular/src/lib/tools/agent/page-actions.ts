import { isTextField, setFieldValue } from '../../page/insert-text'

/** Thrown for actions that can't run; the text goes back to the model. */
export class ActionError extends Error {}

function center(element: Element): { clientX: number; clientY: number } {
  const rect = element.getBoundingClientRect()
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  }
}

/** The element's window, typed with its event constructors. */
function view(element: Element): typeof globalThis {
  return (element.ownerDocument.defaultView ??
    window) as unknown as typeof globalThis
}

function pointer(element: Element, type: string): void {
  const View = view(element)
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...center(element)
  }
  const event =
    type.startsWith('pointer') && typeof View.PointerEvent === 'function'
      ? new View.PointerEvent(type, {
          ...init,
          pointerType: 'mouse',
          isPrimary: true
        })
      : new View.MouseEvent(type.replace('pointer', 'mouse'), init)
  element.dispatchEvent(event)
}

function isDisabled(element: Element): boolean {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

/** Scrolls the element to the middle of the screen. */
export function bringIntoView(element: Element): void {
  element.scrollIntoView?.({ block: 'center', inline: 'center' })
}

/** Hover, press and click, as a mouse would. */
export function clickElement(element: Element): void {
  if (isDisabled(element)) throw new ActionError('The element is disabled.')
  bringIntoView(element)
  pointer(element, 'pointerover')
  pointer(element, 'pointerdown')
  pointer(element, 'mousedown')
  if (element instanceof HTMLElement) element.focus?.({ preventScroll: true })
  pointer(element, 'pointerup')
  pointer(element, 'mouseup')
  if (element instanceof HTMLElement) element.click()
  else
    element.dispatchEvent(
      new (view(element).MouseEvent)('click', {
        bubbles: true,
        cancelable: true,
        ...center(element)
      })
    )
}

export function hoverElement(element: Element): void {
  bringIntoView(element)
  pointer(element, 'pointerover')
  pointer(element, 'pointerenter')
  pointer(element, 'mouseover')
  pointer(element, 'mouseenter')
  pointer(element, 'pointermove')
}

const KEY_CODES: Record<string, string> = {
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Home: 'Home',
  End: 'End',
  ' ': 'Space'
}

/** Key down, then key up, on the element or the focused element. */
export function pressKey(target: Element, key: string): void {
  const View = view(target)
  const init = {
    key,
    code:
      KEY_CODES[key] ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key),
    bubbles: true,
    cancelable: true,
    composed: true
  }
  const allowed = target.dispatchEvent(new View.KeyboardEvent('keydown', init))
  if (allowed && key === 'Enter') submitFromField(target)
  target.dispatchEvent(new View.KeyboardEvent('keyup', init))
}

/** Enter in a single-line field submits its form, like the browser does. */
function submitFromField(target: Element): void {
  if (!(target instanceof HTMLInputElement) || !target.form) return
  const form = target.form
  if (typeof form.requestSubmit === 'function') form.requestSubmit()
  else
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

/** Types into a text field so framework forms see each change. */
export function typeText(
  element: Element,
  text: string,
  options: { clear?: boolean; submit?: boolean } = {}
): string {
  if (!isTextField(element))
    throw new ActionError(
      'The element is not a text field that can be typed into.'
    )
  bringIntoView(element)
  element.focus?.({ preventScroll: true })
  const current =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
      ? element.value
      : (element.textContent ?? '')
  const value = options.clear === false ? current + text : text
  setFieldValue(element, value)
  if (options.submit) pressKey(element, 'Enter')
  return value
}

/** Picks an option by value or by visible label. */
export function selectOption(element: Element, wanted: string): string {
  if (!(element instanceof HTMLSelectElement))
    throw new ActionError(
      'The element is not a select. Click it to open custom dropdowns.'
    )
  const target = wanted.trim().toLowerCase()
  const options = [...element.options]
  const option =
    options.find((entry) => entry.value.toLowerCase() === target) ??
    options.find(
      (entry) => (entry.textContent ?? '').trim().toLowerCase() === target
    ) ??
    options.find((entry) =>
      (entry.textContent ?? '').toLowerCase().includes(target)
    )
  if (!option) {
    const list = options
      .map((entry) => (entry.textContent ?? '').trim())
      .join(', ')
    throw new ActionError(`No option "${wanted}". Options: ${list}`)
  }
  bringIntoView(element)
  const proto = Object.getPrototypeOf(element) as object
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(element, option.value)
  else element.value = option.value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  return (option.textContent ?? option.value).trim()
}

/** Checks or unchecks a checkbox, radio or switch by clicking it if needed. */
export function setChecked(element: Element, checked: boolean): boolean {
  const current =
    element instanceof HTMLInputElement
      ? element.checked
      : element.getAttribute('aria-checked') === 'true'
  if (current !== checked) clickElement(element)
  return element instanceof HTMLInputElement
    ? element.checked
    : element.getAttribute('aria-checked') === 'true'
}

export interface ScrollResult {
  scrollY: number
  atEnd: boolean
}

/** Scrolls the page by screens, or to the element. */
export function scrollPage(
  doc: Document,
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount = 0.8,
  target?: Element | null
): ScrollResult {
  const win = doc.defaultView ?? window
  if (target) {
    bringIntoView(target)
  } else if (direction === 'top') {
    win.scrollTo?.({ top: 0 })
  } else if (direction === 'bottom') {
    win.scrollTo?.({ top: doc.documentElement.scrollHeight })
  } else {
    const by = Math.round(win.innerHeight * Math.min(Math.max(amount, 0.1), 3))
    win.scrollBy?.({ top: direction === 'up' ? -by : by })
  }
  const scrollY = Math.round(win.scrollY)
  const max = doc.documentElement.scrollHeight - win.innerHeight
  return {
    scrollY,
    atEnd:
      direction === 'up' || direction === 'top'
        ? scrollY <= 0
        : scrollY >= max - 2
  }
}
