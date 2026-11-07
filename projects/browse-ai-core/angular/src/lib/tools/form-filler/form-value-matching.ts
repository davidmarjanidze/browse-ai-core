import { parseJsonFromModelResponse } from '../../ai/json-response'
import {
  FormField,
  FormFieldData,
  MatchedFormFieldValue
} from './form-field.model'

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function buildMatchPrompt(
  fields: FormField[],
  userPrompt: string
): string {
  const promptFields: MatchedFormFieldValue[] = fields.map((field) => ({
    id: field.id,
    type: field.type,
    label: field.label,
    name: field.name,
    options: field.options,
    value: ''
  }))
  const outputFormat = {
    id: '<string, unique field identifier>',
    type: "<string, e.g. 'text' | 'textarea' | 'select' | 'checkbox'>",
    label: '<string, human-readable field label>',
    name: '<string, form field name attribute>',
    value: '<string, filled value or empty string if no match>'
  }

  return `
Match the provided HTML FORM FIELDS JSON with the USER-PROVIDED DATA and fill only each field's "value" property. Output the result in OUTPUT FORMAT.

HTML FORM FIELDS JSON:
${JSON.stringify(promptFields, null, 2)}

USER-PROVIDED DATA:
${userPrompt}

OUTPUT FORMAT:
${JSON.stringify(
  fields.map(() => outputFormat),
  null,
  2
)}
`
}

/** Reads `[{ id, type, label, name, value }]` from a model answer. */
export function parseMatchedFormFields(
  content: string
): MatchedFormFieldValue[] {
  const parsed = parseJsonFromModelResponse(content)
  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((candidate): MatchedFormFieldValue[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const value = candidate as Record<string, unknown>
    const read = (key: string): string => String(value[key] ?? '').trim()
    const field = {
      id: read('id'),
      type: read('type'),
      label: read('label'),
      name: read('name'),
      value: read('value')
    }
    return field.id && field.type && field.label && field.name ? [field] : []
  })
}

/**
 * Makes a model value fit the field: a select gets one of its options, a
 * checkbox gets `checked` or nothing, a number gets its first number.
 */
export function normalizeMatchedValue(
  field: FormFieldData,
  rawValue: string
): string {
  const raw = rawValue.trim()
  if (!raw) return ''
  const wanted = raw.toLowerCase()

  if (field.type === 'select' && field.options?.length) {
    const byValue = field.options.find(
      (option) => option.value.trim().toLowerCase() === wanted
    )
    if (byValue) return byValue.value

    const byLabel = field.options.find(
      (option) => option.label.trim().toLowerCase() === wanted
    )
    if (byLabel) return byLabel.value || byLabel.label

    const fuzzy = field.options
      .filter((option) => {
        const label = option.label.trim().toLowerCase()
        return label && (wanted.includes(label) || label.includes(wanted))
      })
      .sort((a, b) => b.label.length - a.label.length)[0]
    return fuzzy ? fuzzy.value || fuzzy.label : raw
  }

  if (field.type === 'checkbox' || field.type === 'radio') {
    const yes =
      ['true', 'yes', '1', 'checked'].includes(wanted) ||
      wanted === field.label.trim().toLowerCase() ||
      wanted === field.name.trim().toLowerCase()
    return yes ? 'checked' : ''
  }

  if (field.type === 'number') {
    return raw.match(/-?\d+(?:\.\d+)?/)?.[0] ?? ''
  }

  return raw
}

/** Joins model answers with the scanned fields. Later answers win. */
export function mergeSuggestions(
  fields: FormField[],
  matches: MatchedFormFieldValue[]
): FormFieldData[] {
  const latest = new Map(matches.map((match) => [match.id, match]))
  return fields.flatMap((field): FormFieldData[] => {
    const match = latest.get(field.id)
    if (!match) return []
    const value = normalizeMatchedValue(field, match.value)
    if (!value) return []
    const { element: _element, ...data } = field
    return [{ ...data, value }]
  })
}
