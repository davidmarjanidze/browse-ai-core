import { extractPageContext } from './page-context.model'
import { rectFromPoints } from './region-selector'

describe('page context', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('reads title, description, headings and text', () => {
    document.head.innerHTML = '<meta name="description" content="About things">'
    document.title = 'My page'
    document.body.innerHTML = '<h1>Main</h1><h2> </h2><p>one two three</p>'
    const context = extractPageContext(document, 'two')
    expect(context.title).toBe('My page')
    expect(context.description).toBe('About things')
    expect(context.headings).toEqual(['Main'])
    expect(context.mainText).toContain('one two three')
    expect(context.wordCount).toBe(4)
    expect(context.selectedText).toBe('two')
    expect(context.domain).toBe('localhost')
  })
})

describe('rectFromPoints', () => {
  it('works in any drag direction', () => {
    expect(rectFromPoints(50, 40, 10, 10)).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 30
    })
  })
})
