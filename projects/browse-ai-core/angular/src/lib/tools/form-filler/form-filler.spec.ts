import {
  extractFieldLabel,
  fillField,
  getFieldType,
  scanFormFields
} from './form-field-scanner'
import {
  buildMatchPrompt,
  chunk,
  mergeSuggestions,
  normalizeMatchedValue,
  parseMatchedFormFields
} from './form-value-matching'

function page(html: string): Document {
  document.body.innerHTML = html
  return document
}

describe('form field scanner', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds labeled fields and skips hidden, disabled and unlabeled ones', () => {
    const doc = page(`
      <div><label for="name">Full name</label><input id="name" name="name"></div>
      <div><label>Email <input type="email" name="email"></label></div>
      <div><input placeholder="Phone" type="tel"></div>
      <div><input type="hidden" name="token"></div>
      <div><input disabled placeholder="Disabled"></div>
      <div><input></div>
      <div><label for="country">Country</label><select id="country"><option value="ge">Georgia</option></select></div>
      <div><textarea placeholder="Notes"></textarea></div>
    `)
    const fields = scanFormFields(doc)
    expect(fields.map((field) => field.label || field.placeholder)).toEqual([
      'Full name',
      'Email',
      'Phone',
      'Country',
      'Notes'
    ])
    expect(fields.map((field) => field.type)).toEqual([
      'text',
      'email',
      'tel',
      'select',
      'textarea'
    ])
    expect(fields[3].options).toEqual([{ value: 'ge', label: 'Georgia' }])
  })

  it('skips fields inside the chat element', () => {
    const doc = page(
      '<div id="chat"><input placeholder="Inside"></div><input placeholder="Outside">'
    )
    const fields = scanFormFields(doc, doc.getElementById('chat')!)
    expect(fields.map((field) => field.placeholder)).toEqual(['Outside'])
  })

  it('reads labels from siblings', () => {
    const doc = page('<div><span>City</span><input></div>')
    expect(extractFieldLabel(doc.querySelector('input')!)).toBe('City')
  })

  it('maps input types', () => {
    const input = document.createElement('input')
    input.type = 'password'
    expect(getFieldType(input)).toBe('text')
    expect(getFieldType(document.createElement('textarea'))).toBe('textarea')
  })

  it('fills fields and fires input and change', () => {
    const doc = page(`
      <input placeholder="Name">
      <input type="checkbox" placeholder="Agree">
      <select placeholder="x"><option value="a">Alpha</option><option value="b">Beta</option></select>
    `)
    const [text, checkbox] = scanFormFields(doc)
    const events: string[] = []
    text.element!.addEventListener('input', () => events.push('input'))
    text.element!.addEventListener('change', () => events.push('change'))

    expect(fillField(text, 'Ana')).toBe(true)
    expect((text.element as HTMLInputElement).value).toBe('Ana')
    expect(events).toEqual(['input', 'change'])

    fillField(checkbox, 'checked')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)

    const select = doc.querySelector('select')!
    fillField(
      { id: 'x', type: 'select', label: '', name: '', element: select },
      'beta'
    )
    expect(select.value).toBe('b')
  })
})

describe('form value matching', () => {
  it('splits fields into groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('builds a prompt with the fields and the user data', () => {
    const prompt = buildMatchPrompt(
      [{ id: 'field_0', type: 'text', label: 'Name', name: 'name' }],
      'I am Ana'
    )
    expect(prompt).toContain('"id": "field_0"')
    expect(prompt).toContain('I am Ana')
  })

  it('parses model answers and drops incomplete entries', () => {
    const parsed = parseMatchedFormFields(
      '```json\n[{"id":"field_0","type":"text","label":"Name","name":"name","value":" Ana "},{"id":"x"}]\n```'
    )
    expect(parsed).toEqual([
      { id: 'field_0', type: 'text', label: 'Name', name: 'name', value: 'Ana' }
    ])
  })

  it('normalizes values to fit the field', () => {
    const select = {
      id: 's',
      type: 'select',
      label: 'Role',
      name: 'role',
      options: [
        { value: 'dev', label: 'Developer' },
        { value: 'arch', label: 'Cloud Architect' }
      ]
    }
    expect(normalizeMatchedValue(select, 'developer')).toBe('dev')
    expect(normalizeMatchedValue(select, 'Senior Cloud Architect')).toBe('arch')
    expect(
      normalizeMatchedValue({ ...select, type: 'checkbox', options: [] }, 'yes')
    ).toBe('checked')
    expect(
      normalizeMatchedValue({ ...select, type: 'checkbox', options: [] }, 'no')
    ).toBe('')
    expect(
      normalizeMatchedValue(
        { ...select, type: 'number', options: [] },
        '8+ years'
      )
    ).toBe('8')
    expect(normalizeMatchedValue({ ...select, type: 'text' }, '  ')).toBe('')
  })

  it('merges answers with the scanned fields', () => {
    const fields = [
      { id: 'field_0', type: 'text', label: 'Name', name: 'name' },
      { id: 'field_1', type: 'text', label: 'City', name: 'city' }
    ]
    const merged = mergeSuggestions(fields, [
      {
        id: 'field_0',
        type: 'text',
        label: 'Name',
        name: 'name',
        value: 'Ana'
      },
      { id: 'field_1', type: 'text', label: 'City', name: 'city', value: '' }
    ])
    expect(merged).toEqual([{ ...fields[0], value: 'Ana' }])
  })
})
