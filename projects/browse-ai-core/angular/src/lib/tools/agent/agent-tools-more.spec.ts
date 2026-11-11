import { TestBed } from '@angular/core/testing'
import { openInNewTab } from 'browse-ai-core'
import {
  fakeAi,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import type { ToolRequest } from '../../chat/tool-runner'
import { ToolNotices } from '../../chat/tool-notices'
import { parseAgentCall } from './agent-protocol'
import { AgentRunnerService } from './agent-runner.service'
import type { AgentToolContext } from './agent-tool-base'
import { AGENT_TOOLS } from './agent-tools'
import { MORE_AGENT_TOOLS, PAGE_TEXT_CHUNK } from './agent-tools-more'
import { RefMap } from './page-snapshot'

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
    ...overrides
  }
}

const tool = (name: string) =>
  MORE_AGENT_TOOLS.find((entry) => entry.name === name)!

describe('more agent tools', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('opens a link in a new tab, and posts it in the chat when blocked', async () => {
    document.body.innerHTML = '<a href="https://example.org/item">Item</a>'
    const ctx = context()
    const ref = ctx.refs.add(document.querySelector('a')!)
    const opened: string[] = []
    ctx.openTab = async (url) => {
      opened.push(url)
      return 'opened'
    }
    expect(await tool('open_in_new_tab').run({ ref }, ctx)).toContain(
      'Opened https://example.org/item'
    )
    expect(opened).toEqual(['https://example.org/item'])

    const notes: string[] = []
    const blocked = context({
      openTab: async () => 'blocked',
      notify: (text) => notes.push(text)
    })
    expect(
      await tool('open_in_new_tab').run(
        { url: 'https://example.org/x' },
        blocked
      )
    ).toContain('blocked')
    expect(notes).toEqual(['[https://example.org/x](https://example.org/x)'])
    await expect(async () =>
      tool('open_in_new_tab').run({ url: 'javascript:alert(1)' }, ctx)
    ).rejects.toThrow()
  })

  it('openInNewTab uses window.open outside an extension and says when it is blocked', async () => {
    const win = { opener: {} }
    vi.stubGlobal(
      'open',
      vi.fn(() => win)
    )
    expect(await openInNewTab('https://example.org/')).toBe('opened')
    expect(win.opener).toBeNull()
    vi.stubGlobal(
      'open',
      vi.fn(() => null)
    )
    expect(await openInNewTab('https://example.org/')).toBe('blocked')
  })

  it('reads the page text in parts', async () => {
    document.body.textContent = 'a'.repeat(PAGE_TEXT_CHUNK + 10)
    const first = String(await tool('read_page_text').run({}, context()))
    expect(first).toContain(`next offset ${PAGE_TEXT_CHUNK}`)
    const second = String(
      await tool('read_page_text').run({ offset: PAGE_TEXT_CHUNK }, context())
    )
    expect(second.startsWith('aaaaaaaaaa\n')).toBe(true)
  })

  it('reads a table by index or by an element inside it', async () => {
    document.body.innerHTML =
      '<table><tr><th>Item</th><th>Price</th></tr><tr><td>Shirt</td><td><b>25</b></td></tr></table>'
    expect(await tool('read_table').run({ index: 0 }, context())).toBe(
      'Item | Price\nShirt | 25'
    )
    const ctx = context()
    const ref = ctx.refs.add(document.querySelector('b')!)
    expect(await tool('read_table').run({ ref }, ctx)).toContain('Shirt | 25')
    expect(await tool('read_table').run({ index: 3 }, context())).toContain(
      'No such table'
    )
  })

  it('fills several fields at once and reports each one', async () => {
    document.body.innerHTML = `
      <input aria-label="Name" />
      <select aria-label="Size"><option>S</option><option>M</option></select>
      <input type="checkbox" aria-label="Gift" />
      <input type="password" aria-label="Password" />`
    const ctx = context()
    const [name, size, gift, password] = [
      ...document.querySelectorAll('input, select')
    ].map((element) => ctx.refs.add(element))
    const result = String(
      await tool('fill_form').run(
        {
          fields: JSON.stringify({
            [name]: 'Ana',
            [size]: 'M',
            [gift]: true,
            [password]: 'x'
          })
        },
        ctx
      )
    )
    expect((document.querySelector('input') as HTMLInputElement).value).toBe(
      'Ana'
    )
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe(
      'M'
    )
    expect(
      (document.querySelector('[type=checkbox]') as HTMLInputElement).checked
    ).toBe(true)
    expect(result).toContain('Size: selected "M"')
    expect(result).toContain('off limits')
  })

  it('scroll_inside needs a scrollable box', () => {
    document.body.innerHTML = '<p>Plain</p>'
    const ctx = context()
    const ref = ctx.refs.add(document.querySelector('p')!)
    expect(() =>
      tool('scroll_inside').run({ ref, direction: 'down' }, ctx)
    ).toThrow(/No scrollable box/u)
  })

  it('accepts object arguments as objects or JSON strings', () => {
    expect(
      parseAgentCall(
        '{"tool":"fill_form","args":{"fields":{"1":"a"}}}',
        AGENT_TOOLS
      )
    ).not.toHaveProperty('error')
    expect(
      parseAgentCall(
        '{"tool":"fill_form","args":{"fields":"{\\"1\\":\\"a\\"}"}}',
        AGENT_TOOLS
      )
    ).not.toHaveProperty('error')
    expect(
      parseAgentCall('{"tool":"fill_form","args":{"fields":5}}', AGENT_TOOLS)
    ).toHaveProperty('error')
  })
})

describe('AgentRunnerService with saved notes and messages', () => {
  it('sends saved notes with later steps and posts show_user messages', async () => {
    document.body.innerHTML = ''
    const prompts: string[] = []
    const replies = [
      '{"tool":"remember","args":{"note":"Blue shirt costs 19"}}',
      '{"tool":"done","args":{"summary":"ok"}}'
    ]
    const fake = fakeAi({
      reply: (input) => {
        prompts.push(promptText(input))
        return replies.shift() ?? '{"tool":"done","args":{"summary":"ok"}}'
      }
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const notices: string[] = []
    TestBed.inject(ToolNotices).posted.subscribe((notice) =>
      notices.push(notice.text)
    )
    const request: ToolRequest = {
      text: 'Compare prices',
      selection: null,
      framework: 'angular',
      signal: new AbortController().signal,
      onChunk: () => undefined,
      onStatus: () => undefined
    }
    await TestBed.inject(AgentRunnerService).run(request)
    expect(prompts[0]).not.toContain('YOUR SAVED NOTES')
    expect(prompts[1]).toContain('YOUR SAVED NOTES:\n- Blue shirt costs 19')
    expect(fake.sessions[0].systemPrompt).toContain('open_in_new_tab')
    expect(notices).toEqual([])
  })
})
