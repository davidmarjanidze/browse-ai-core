import { DOM_COMPONENT_FRAMEWORKS } from '../tools.model'
import {
  buildComponentPrompt,
  normalizeDomToNativeHtml
} from './component-prompt'
import { describeElement } from './dom-inspector.service'

describe('DOM to component', () => {
  it('describes elements', () => {
    const element = document.createElement('div')
    element.id = 'main'
    element.className = 'card wide extra'
    expect(describeElement(element)).toBe('div#main.card.wide')
  })

  it('replaces custom elements with native ones', () => {
    const html = normalizeDomToNativeHtml(
      document,
      '<mat-card class="x"><mat-button role="button">Go</mat-button></mat-card>'
    )
    expect(html).toBe('<div class="x"><button role="button">Go</button></div>')
  })

  it('builds a prompt for the chosen framework', () => {
    const prompt = buildComponentPrompt(
      document,
      '<p>Hi</p>',
      DOM_COMPONENT_FRAMEWORKS.React
    )
    expect(prompt).toContain('reusable React component')
    expect(prompt).toContain('Target React v19')
    expect(prompt).toContain('<p>Hi</p>')
  })
})
