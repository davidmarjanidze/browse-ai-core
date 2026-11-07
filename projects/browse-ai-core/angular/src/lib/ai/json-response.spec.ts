import { cleanModelText, parseJsonFromModelResponse } from './json-response'

describe('parseJsonFromModelResponse', () => {
  it('parses plain and fenced JSON', () => {
    expect(parseJsonFromModelResponse(' {"a":1} ')).toEqual({ a: 1 })
    expect(parseJsonFromModelResponse('```json\n[1,2]\n```')).toEqual([1, 2])
  })

  it('returns null for text', () => {
    expect(parseJsonFromModelResponse('no json here')).toBeNull()
  })
})

describe('cleanModelText', () => {
  it('removes wrapper tags the model adds around text', () => {
    expect(cleanModelText('<note>Writing has five steps.</note>')).toBe(
      'Writing has five steps.'
    )
    expect(cleanModelText(' <Note> A </Note> ')).toBe('A')
    expect(cleanModelText('<point>One</point>')).toBe('One')
    expect(cleanModelText('<note>Unclosed')).toBe('Unclosed')
  })

  it('keeps tags that are part of the text', () => {
    expect(cleanModelText('Use the <div> element.')).toBe(
      'Use the <div> element.'
    )
    expect(cleanModelText('a < b and c > d')).toBe('a < b and c > d')
  })
})
