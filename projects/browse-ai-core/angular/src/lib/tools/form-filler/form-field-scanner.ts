import { FormControlElement, FormField } from './form-field.model'

const INPUT_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'

const KNOWN_INPUT_TYPES = new Set([
  'text',
  'email',
  'tel',
  'number',
  'date',
  'checkbox',
  'radio'
])

export function getFieldType(element: FormControlElement): string {
  if (element instanceof HTMLSelectElement) return 'select'
  if (element instanceof HTMLTextAreaElement) return 'textarea'
  const type = element.type?.toLowerCase() || 'text'
  if (type === 'phone') return 'tel'
  return KNOWN_INPUT_TYPES.has(type) ? type : 'text'
}

export function getFieldValue(element: FormControlElement): string | undefined {
  if (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  ) {
    return element.checked ? 'checked' : undefined
  }
  return element.value
}

const shortText = (element: Element | null): string => {
  const text = element?.textContent?.trim() ?? ''
  return text.length > 0 && text.length < 100 ? text : ''
}

/**
 * Finds the label of a field: `label[for]`, a wrapping `<label>`, the
 * nearest previous sibling with short text, or a label-like sibling.
 */
export function extractFieldLabel(element: FormControlElement): string {
  const doc = element.ownerDocument

  if (element.id) {
    const label = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }

  const wrappingLabel = element.closest('label')
  if (wrappingLabel?.textContent) {
    const text = wrappingLabel.textContent
      .replace(getFieldValue(element) || '', '')
      .trim()
    if (text) return text
  }

  for (
    let sibling = element.previousElementSibling;
    sibling;
    sibling = sibling.previousElementSibling
  ) {
    const text = shortText(sibling)
    if (text) return text
  }

  for (const child of Array.from(element.parentElement?.children ?? [])) {
    if (
      child === element ||
      !['LABEL', 'SPAN', 'DIV'].includes(child.tagName)
    ) {
      continue
    }
    const text = shortText(child)
    if (text) return text
  }

  return ''
}

function createFormField(
  element: FormControlElement,
  index: number
): FormField | null {
  if (element.hidden || element.disabled) return null

  const label = extractFieldLabel(element)
  const placeholder =
    element instanceof HTMLSelectElement
      ? undefined
      : element.placeholder || undefined
  if (!label && !placeholder) return null

  const rect = element.getBoundingClientRect()
  const field: FormField = {
    id: `field_${index}`,
    type: getFieldType(element),
    label,
    name: element.name || element.id || `field_${index}`,
    placeholder,
    value: getFieldValue(element),
    required: element.hasAttribute('required'),
    element,
    x: rect.left + (element.ownerDocument.defaultView?.scrollX ?? 0),
    y: rect.top + (element.ownerDocument.defaultView?.scrollY ?? 0),
    width: rect.width,
    height: rect.height
  }

  if (element instanceof HTMLSelectElement) {
    field.options = Array.from(element.options).map((option) => ({
      value: option.value,
      label: option.text || option.value
    }))
  }
  return field
}

/**
 * Every labeled input, textarea and select on the page, in document order.
 * Fields inside `exclude` (the chat itself) are skipped.
 */
export function scanFormFields(doc: Document, exclude?: Element): FormField[] {
  return Array.from(doc.querySelectorAll<FormControlElement>(INPUT_SELECTOR))
    .filter((element) => !exclude?.contains(element))
    .map((element, index) => createFormField(element, index))
    .filter((field): field is FormField => field !== null)
}

function findOption(
  element: HTMLSelectElement,
  value: string
): HTMLOptionElement | undefined {
  const options = Array.from(element.options)
  const wanted = value.trim().toLowerCase()
  return (
    options.find((option) => option.value === value) ??
    options.find((option) => option.text.trim().toLowerCase() === wanted) ??
    options.find((option) => option.value.trim().toLowerCase() === wanted)
  )
}

/** Writes `value` into the field and fires `input` and `change`. */
export function fillField(field: FormField, value: string): boolean {
  const element = field.element
  if (!element) return false

  if (element instanceof HTMLSelectElement) {
    element.value = findOption(element, value)?.value ?? value
  } else if (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  ) {
    element.checked = value === 'checked'
  } else {
    element.value = value
  }

  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}
