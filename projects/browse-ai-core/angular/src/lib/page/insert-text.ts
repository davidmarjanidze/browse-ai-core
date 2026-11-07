export type TextField = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel'])

/** Fields whose values must never be read, filled or sent to the model. */
export function isSensitiveField(element: Element): boolean {
  const autocomplete = (
    element.getAttribute('autocomplete') ?? ''
  ).toLowerCase()
  const type = (element.getAttribute('type') ?? '').toLowerCase()
  return (
    type === 'password' ||
    autocomplete.startsWith('cc-') ||
    autocomplete === 'one-time-code' ||
    autocomplete.includes('password')
  )
}

/** A textarea, a text-like input or a contenteditable element. */
export function isTextField(element: unknown): element is TextField {
  if (!(element instanceof HTMLElement)) return false
  if (isSensitiveField(element)) return false
  if (element instanceof HTMLTextAreaElement)
    return !element.disabled && !element.readOnly
  if (element instanceof HTMLInputElement) {
    return (
      TEXT_INPUT_TYPES.has(
        (element.getAttribute('type') ?? '').toLowerCase()
      ) &&
      !element.disabled &&
      !element.readOnly
    )
  }
  return (
    element.isContentEditable ||
    element.getAttribute('contenteditable') === 'true'
  )
}

const isValueField = (
  field: TextField
): field is HTMLInputElement | HTMLTextAreaElement =>
  field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement

export function readFieldValue(field: TextField): string {
  return isValueField(field) ? field.value : (field.textContent ?? '')
}

/** Label text, aria-label, placeholder or name of a field. */
export function describeField(field: Element): string {
  const id = field.getAttribute('id')
  const label =
    (id &&
      field.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
    field.closest('label')
  const text =
    label?.textContent?.trim() ||
    field.getAttribute('aria-label') ||
    field.getAttribute('placeholder') ||
    field.getAttribute('name') ||
    field.tagName.toLowerCase()
  return text.replace(/\s+/gu, ' ').slice(0, 60)
}

/**
 * Sets the value with the native setter, then fires `input` and `change`, so
 * frameworks that track the value (React, Vue, Angular) see the change.
 */
export function setFieldValue(field: TextField, value: string): void {
  if (isValueField(field)) {
    const proto = Object.getPrototypeOf(field) as object
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(field, value)
    else field.value = value
  } else {
    field.textContent = value
  }
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Inserts text at the cursor, or at the end when there is no cursor. */
export function insertAtCursor(field: TextField, text: string): void {
  const current = readFieldValue(field)
  if (!isValueField(field)) {
    setFieldValue(field, current ? `${current} ${text}` : text)
    return
  }
  const start = field.selectionStart ?? current.length
  const end = field.selectionEnd ?? current.length
  const spaceBefore = start > 0 && !/\s$/u.test(current.slice(0, start))
  const spaceAfter = end < current.length && !/^\s/u.test(current.slice(end))
  const insert = `${spaceBefore ? ' ' : ''}${text}`
  setFieldValue(
    field,
    current.slice(0, start) +
      insert +
      (spaceAfter ? ' ' : '') +
      current.slice(end)
  )
  const cursor = start + insert.length
  field.setSelectionRange?.(cursor, cursor)
}

/** The field's `maxlength`, or null when it has none. */
export function maxLengthOf(field: TextField): number | null {
  return isValueField(field) && field.maxLength > 0 ? field.maxLength : null
}
