import { parseJsonFromModelResponse } from './json-response'

describe('parseJsonFromModelResponse', () => {
  it('parses plain and fenced JSON', () => {
    expect(parseJsonFromModelResponse(' {"a":1} ')).toEqual({ a: 1 })
    expect(parseJsonFromModelResponse('```json\n[1,2]\n```')).toEqual([1, 2])
  })

  it('returns null for text', () => {
    expect(parseJsonFromModelResponse('no json here')).toBeNull()
  })
})
