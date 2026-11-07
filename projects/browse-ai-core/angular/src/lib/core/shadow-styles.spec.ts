import { applyThemeCss, trapFocus } from './shadow-styles'

describe('shadow styles', () => {
  it('writes and updates one theme style element', () => {
    const root = document.createElement('div').attachShadow({ mode: 'open' })
    applyThemeCss(root, ':host{--a:1}')
    applyThemeCss(root, ':host{--a:2}')
    const styles = root.querySelectorAll('style')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe(':host{--a:2}')
  })

  it('wraps focus from the last to the first element', () => {
    const container = document.createElement('div')
    container.innerHTML = '<button>a</button><button>b</button>'
    document.body.appendChild(container)
    const [first, last] = Array.from(container.querySelectorAll('button'))
    for (const button of [first, last])
      button.getClientRects = () => [{}] as unknown as DOMRectList
    last.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    trapFocus(event, container)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    container.remove()
  })
})
