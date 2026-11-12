import type { AgentToolContext } from './agent-tool-base'
import { AGENT_TOOLS } from './agent-tools'
import { EXTRA_AGENT_TOOLS } from './agent-tools-extra'
import { fileNameOf } from './page-images'
import { RefMap } from './page-snapshot'
import { riskOf } from './risk-check'

function context(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    doc: document,
    host: null,
    refs: new RefMap(),
    signal: new AbortController().signal,
    screenshot: async () => undefined,
    askUser: async () => '',
    notify: () => undefined,
    remember: () => undefined,
    openTab: async () => 'opened',
    riskWords: ['buy', 'pay', 'delete'],
    ...overrides
  }
}

const tool = (name: string) =>
  [...EXTRA_AGENT_TOOLS, ...AGENT_TOOLS].find((entry) => entry.name === name)!

/** Gives an element a layout box (jsdom has none). */
function box(element: Element, top: number, width = 200, height = 150): void {
  element.getBoundingClientRect = () => new DOMRect(0, top, width, height)
}

const $ = (selector: string): HTMLElement =>
  document.querySelector<HTMLElement>(selector)!

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('find_images', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <img id="icon" src="/i/cart.svg" alt="Cart">
      <img id="plane" src="/photos/jet.jpg" alt="Red airplane over the sea">
      <figure><img id="cat" src="/photos/x1.jpg"><figcaption>A sleeping cat</figcaption></figure>
      <div id="bg" style="background-image: url('/img/blue-plane_2.webp')"></div>
      <img id="hidden" src="/h.jpg" alt="airplane" style="display:none">`
    box($('#icon'), 10, 16, 16)
    box($('#plane'), 2000)
    box($('#cat'), 100)
    box($('#bg'), -900)
    box($('#hidden'), 100)
  })

  it('lists content images with their place on the page, skips icons and hidden ones', () => {
    const result = String(tool('find_images').run({}, context()))
    expect(result).toContain('3 image(s)')
    expect(result).toContain('"Red airplane over the sea" 200x150 below')
    expect(result).toContain('"A sleeping cat" 200x150 in view')
    expect(result).toContain('"blue plane 2" 200x150 above')
    expect(result).not.toContain('Cart')
  })

  it('finds images by words, most matches first', () => {
    const result = String(
      tool('find_images').run({ text: 'red airplane' }, context())
    )
    const lines = result.split('\n')
    expect(lines[0]).toBe('1 image(s):')
    expect(lines[1]).toContain('Red airplane')
    const plane = String(tool('find_images').run({ text: 'plane' }, context()))
    expect(plane).toContain('blue plane 2')
    expect(plane).not.toContain('cat')
  })

  it('tells the model to scroll or take a screenshot when nothing matches', () => {
    expect(
      String(tool('find_images').run({ text: 'giraffe' }, context()))
    ).toBe(
      'No image matches "giraffe". Scroll and try again, or take a screenshot.'
    )
  })

  it('turns a file address into words', () => {
    expect(fileNameOf('https://x.org/a/red-plane_2.jpg?w=300')).toBe(
      'red plane 2'
    )
    expect(fileNameOf('/a/%E0%A4%A.png')).toBe('%E0%A4%A')
  })
})

describe('set_value', () => {
  it('sets dates, times, colors and ranges, and fires input and change', () => {
    document.body.innerHTML = `
      <input id="d" type="date"><input id="t" type="time">
      <input id="c" type="color"><input id="r" type="range" min="0" max="10" step="2">`
    const ctx = context()
    const events: string[] = []
    $('#d').addEventListener('change', () => events.push('change'))
    $('#d').addEventListener('input', () => events.push('input'))
    const set = (id: string, value: string) =>
      String(tool('set_value').run({ ref: ctx.refs.add($(id)), value }, ctx))
    expect(set('#d', '2026-03-31')).toBe('Set to 2026-03-31.')
    expect(events).toEqual(['input', 'change'])
    expect(set('#t', '14:30')).toBe('Set to 14:30.')
    expect(set('#c', '#f80')).toBe('Set to #ff8800.')
    expect(set('#r', '6')).toBe('Set to 6.')
    expect(set('#r', '50')).toContain('Set to 10 (moved from 50')
    expect(set('#r', '7')).toContain('Set to 8 (moved from 7')
  })

  it('explains the format and refuses text fields', () => {
    document.body.innerHTML =
      '<input id="d" type="date"><input id="name" type="text">'
    const ctx = context()
    expect(() =>
      tool('set_value').run(
        { ref: ctx.refs.add($('#d')), value: '31.03.2026' },
        ctx
      )
    ).toThrowError(/Use the form 2026-03-31/u)
    expect(() =>
      tool('set_value').run({ ref: ctx.refs.add($('#name')), value: 'x' }, ctx)
    ).toThrowError('Use type_text for text fields or select_option for lists.')
    expect(($('#name') as HTMLInputElement).value).toBe('')
  })
})

describe('close_overlay', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 300, 200)
    )
  })

  it('declines a cookie banner and never accepts it', async () => {
    document.body.innerHTML = `
      <div role="dialog" id="cookies">We use cookies
        <button id="accept">Accept all</button>
        <button id="reject">Reject all</button>
      </div>`
    const clicked: string[] = []
    for (const id of ['#accept', '#reject'])
      $(id).addEventListener('click', () => {
        clicked.push(id)
        $('#cookies').remove()
      })
    const result = await tool('close_overlay').run({}, context())
    expect(clicked).toEqual(['#reject'])
    expect(result).toBe('Clicked "Reject all". The pop-up is gone.')
  })

  it('uses the × button of a modal', async () => {
    document.body.innerHTML = `
      <div aria-modal="true" id="modal">Join our newsletter
        <button id="close" aria-label="Close">×</button>
        <button>Subscribe</button>
      </div>`
    $('#close').addEventListener('click', () => ($('#modal').hidden = true))
    $('#modal').hidden = false
    const result = await tool('close_overlay').run({}, context())
    expect(result).toContain('Clicked "Close"')
  })

  it('presses Escape when there is only an agree button', async () => {
    document.body.innerHTML = `
      <div role="dialog" id="d">Terms <button id="ok">I agree</button></div>`
    const keys: string[] = []
    let clicks = 0
    $('#ok').addEventListener('click', () => clicks++)
    document.addEventListener('keydown', (event) => keys.push(event.key))
    const result = await tool('close_overlay').run({}, context())
    expect(clicks).toBe(0)
    expect(keys).toEqual(['Escape'])
    expect(result).toContain('Pressed Escape (no close button)')
    expect(result).toContain('still there')
  })

  it('skips a close button that is a link to another page', async () => {
    document.body.innerHTML = `
      <div role="dialog"><a href="https://other.example/close">Close</a></div>`
    const result = await tool('close_overlay').run({}, context())
    expect(result).toContain('Pressed Escape')
  })

  it('says when there is no pop-up', async () => {
    document.body.innerHTML = '<main><button>Close</button></main>'
    expect(await tool('close_overlay').run({}, context())).toBe(
      'No pop-up found.'
    )
  })
})

describe('right_click, read_selection', () => {
  it('fires the right button events in order', () => {
    document.body.innerHTML = '<div id="file">report.pdf</div>'
    const seen: string[] = []
    for (const type of [
      'pointerdown',
      'mousedown',
      'contextmenu',
      'pointerup',
      'mouseup'
    ])
      $('#file').addEventListener(type, (event) =>
        seen.push(`${type}:${(event as MouseEvent).button}`)
      )
    const ctx = context()
    expect(
      tool('right_click').run({ ref: ctx.refs.add($('#file')) }, ctx)
    ).toBe('Right-clicked. Look for the menu in ELEMENTS.')
    expect(seen).toEqual([
      'pointerdown:2',
      'mousedown:2',
      'contextmenu:2',
      'pointerup:2',
      'mouseup:2'
    ])
  })

  it('reads the selected text, but not in the chat or when nothing is selected', () => {
    document.body.innerHTML =
      '<p id="p">Order number 12345 is shipped</p><div id="chat"><p id="c">secret chat</p></div>'
    const select = (element: Element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      document.getSelection()!.removeAllRanges()
      document.getSelection()!.addRange(range)
    }
    const ctx = context({ host: $('#chat') })
    document.getSelection()!.removeAllRanges()
    expect(tool('read_selection').run({}, ctx)).toBe('Nothing is selected.')
    select($('#p'))
    expect(tool('read_selection').run({}, ctx)).toMatch(
      /^Selected in \[\d+\]: "Order number 12345 is shipped"$/u
    )
    select($('#c'))
    expect(tool('read_selection').run({}, ctx)).toBe('Nothing is selected.')
    document.getSelection()!.removeAllRanges()
  })
})

describe('wait_for_url, go_forward', () => {
  afterEach(() => history.replaceState(null, '', '/'))

  it('waits for an address change made with pushState', async () => {
    setTimeout(() => history.pushState(null, '', '/step2'), 50)
    const result = await tool('wait_for_url').run({}, context())
    expect(result).toMatch(/^Address is now .*\/step2$/u)
  })

  it('waits for an address that contains a text, or times out', async () => {
    setTimeout(() => history.pushState(null, '', '/a'), 20)
    setTimeout(() => history.pushState(null, '', '/checkout'), 80)
    expect(
      await tool('wait_for_url').run({ contains: 'checkout' }, context())
    ).toMatch(/checkout$/u)
    expect(
      await tool('wait_for_url').run(
        { contains: 'never', timeoutMs: 100 },
        context()
      )
    ).toBe('timeout')
  })

  it('go_forward moves forward in history and asks first', () => {
    const forward = vi.spyOn(history, 'forward').mockImplementation(() => {})
    expect(tool('go_forward').run({}, context())).toBe('Went forward.')
    expect(forward).toHaveBeenCalled()
    expect(riskOf('go_forward', null, document, 'risky', [])).toBe('navigate')
    expect(riskOf('go_forward', null, document, 'never', [])).toBeNull()
  })

  it('set_value and right_click ask only when every step needs an OK', () => {
    document.body.innerHTML = '<input type="date">'
    const input = $('input')
    for (const action of ['set_value', 'right_click', 'close_overlay']) {
      expect(riskOf(action, input, document, 'always', [])).toBe('always')
      expect(riskOf(action, input, document, 'risky', [])).toBeNull()
    }
  })
})
