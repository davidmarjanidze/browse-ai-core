import { DEFAULT_STRINGS, formatString } from './strings'

describe('formatString', () => {
  it('replaces placeholders and keeps unknown ones', () => {
    expect(formatString('{a} and {b}', { a: 1 })).toBe('1 and {b}')
  })

  it('works with default strings', () => {
    expect(formatString(DEFAULT_STRINGS.contextUsage, { percent: 40 })).toBe(
      '40% of chat memory used'
    )
  })
})
