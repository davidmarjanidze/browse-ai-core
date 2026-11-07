export type FormControlElement =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface FormFieldOption {
  value: string
  label: string
}

export interface FormField {
  id: string
  /** text, email, tel, number, date, checkbox, radio, select or textarea. */
  type: string
  label: string
  name: string
  placeholder?: string
  value?: string
  required?: boolean
  options?: FormFieldOption[]
  element?: FormControlElement
  x?: number
  y?: number
  width?: number
  height?: number
}

/** A form field without the DOM element, safe to keep in chat messages. */
export type FormFieldData = Omit<FormField, 'element'>

export interface MatchedFormFieldValue {
  id: string
  type: string
  label: string
  name: string
  options?: FormFieldOption[]
  value: string
}
