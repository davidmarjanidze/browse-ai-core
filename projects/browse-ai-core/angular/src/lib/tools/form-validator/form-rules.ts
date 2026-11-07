import { FormControlElement } from '../form-filler/form-field.model'
import { extractFieldLabel } from '../form-filler/form-field-scanner'
import { isSensitiveField } from '../../page/insert-text'

export type RuleId =
  | 'valueMissing'
  | 'typeMismatch'
  | 'patternMismatch'
  | 'tooShort'
  | 'tooLong'
  | 'rangeUnderflow'
  | 'rangeOverflow'
  | 'stepMismatch'
  | 'email'
  | 'confirm'
  | 'spaces'
  | 'pastDate'

export interface RuleProblem {
  element: FormControlElement
  rule: RuleId
  /** The rule's value, for example the pattern or the minimum length. */
  detail: string
}

const VALIDITY_RULES: readonly RuleId[] = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooShort',
  'tooLong',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch'
]

/** Rules still checked on sensitive fields such as passwords. */
const SENSITIVE_RULES = new Set<RuleId>(['valueMissing', 'tooShort', 'confirm'])

const FIELDS =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

function isVisible(element: Element): boolean {
  if ((element as HTMLElement).hidden) return false
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  return !style || (style.display !== 'none' && style.visibility !== 'hidden')
}

/** Visible fields in a form or other container, in page order. */
export function formFields(root: ParentNode): FormControlElement[] {
  return Array.from(root.querySelectorAll<FormControlElement>(FIELDS)).filter(
    (element) => !element.disabled && isVisible(element)
  )
}

function describe(element: FormControlElement): string {
  return `${extractFieldLabel(element)} ${element.name} ${element.id}`.toLowerCase()
}

function ruleDetail(element: FormControlElement, rule: RuleId): string {
  const attr = (name: string) => element.getAttribute(name) ?? ''
  switch (rule) {
    case 'patternMismatch':
      return attr('pattern')
    case 'tooShort':
      return attr('minlength')
    case 'tooLong':
      return attr('maxlength')
    case 'rangeUnderflow':
      return attr('min')
    case 'rangeOverflow':
      return attr('max')
    case 'stepMismatch':
      return attr('step')
    case 'typeMismatch':
      return attr('type')
    default:
      return ''
  }
}

/** Reads "2024-05", "2024-05-31", "05/24" and "05/2024" as a month end. */
export function parseExpiry(value: string): Date | null {
  const iso = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/u)
  if (iso) {
    const [year, month] = [Number(iso[1]), Number(iso[2])]
    return iso[3]
      ? new Date(year, month - 1, Number(iso[3]))
      : new Date(year, month, 0)
  }
  const short = value.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/u)
  if (short) {
    const year =
      short[2].length === 2 ? 2000 + Number(short[2]) : Number(short[2])
    return new Date(year, Number(short[1]), 0)
  }
  return null
}

/** Problems with one field. `previous` is the field before it in the form. */
export function checkField(
  element: FormControlElement,
  previous: FormControlElement | null,
  now = new Date()
): RuleProblem[] {
  const problems: RuleProblem[] = []
  const add = (rule: RuleId) =>
    problems.push({ element, rule, detail: ruleDetail(element, rule) })
  const validity = element.validity
  for (const rule of VALIDITY_RULES) {
    if (validity?.[rule as keyof ValidityState]) add(rule)
  }
  // jsdom and old browsers only set tooShort after the user types.
  const minLength = Number(element.getAttribute('minlength'))
  if (
    minLength &&
    element.value &&
    element.value.length < minLength &&
    !problems.some((p) => p.rule === 'tooShort')
  )
    add('tooShort')

  const value = element.value ?? ''
  const text = describe(element)
  const type = (element.getAttribute('type') ?? '').toLowerCase()
  if (
    value &&
    type !== 'email' &&
    /e-?mail/u.test(text) &&
    !EMAIL.test(value.trim())
  )
    add('email')
  if (
    value &&
    previous &&
    /confirm|repeat|again|retype/u.test(text) &&
    previous.getAttribute('type') === element.getAttribute('type') &&
    previous.value !== value
  ) {
    add('confirm')
  }
  if (
    value &&
    !(element instanceof HTMLSelectElement) &&
    value !== value.trim()
  )
    add('spaces')
  if (value && /expir/u.test(text)) {
    const date = parseExpiry(value.trim())
    if (date && date < new Date(now.getFullYear(), now.getMonth(), 1))
      add('pastDate')
  }

  const kept = isSensitiveField(element)
    ? problems.filter((p) => SENSITIVE_RULES.has(p.rule))
    : problems
  return kept.length ? [kept[0]] : []
}

export function checkFields(
  fields: FormControlElement[],
  now = new Date()
): RuleProblem[] {
  return fields.flatMap((field, index) =>
    checkField(field, index > 0 ? fields[index - 1] : null, now)
  )
}

/** The form to check: the one used last, else the one with most fields. */
export function pickForm(
  doc: Document,
  last: HTMLFormElement | null
): ParentNode | null {
  if (last?.isConnected) return last
  const forms = Array.from(doc.forms)
  if (forms.length) {
    return forms.reduce((best, form) =>
      formFields(form).length > formFields(best).length ? form : best
    )
  }
  return doc.body && formFields(doc.body).length ? doc.body : null
}
