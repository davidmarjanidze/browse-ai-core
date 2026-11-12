import { TestBed } from '@angular/core/testing'
import {
  AGENT_TOOL_NAMES,
  DEFAULT_AGENT_OPTIONS,
  resolveConfig
} from 'browse-ai-core'
import {
  fakeAi,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import type { ToolRequest } from '../../chat/tool-runner'
import { buildAgentSystemPrompt } from './agent-protocol'
import { AgentRunnerService } from './agent-runner.service'
import type { AgentToolContext } from './agent-tool-base'
import { AGENT_TOOLS, agentTools } from './agent-tools'
import { EXTRA_AGENT_TOOLS } from './agent-tools-extra'
import { parseAmount, parsePrice } from './page-lists'
import { RefMap } from './page-snapshot'

function context(): AgentToolContext {
  return {
    doc: document,
    host: null,
    refs: new RefMap(),
    signal: new AbortController().signal,
    screenshot: async () => undefined,
    askUser: async () => '',
    notify: () => undefined,
    remember: () => undefined,
    openTab: async () => 'opened'
  }
}

const extractList = EXTRA_AGENT_TOOLS.find(
  (tool) => tool.name === 'extract_list'
)!

const GRID = `
  <nav><ul>
    <li><a href="/">Home</a></li><li><a href="/men">Men</a></li>
    <li><a href="/women">Women</a></li><li><a href="/kids">Kids</a></li>
    <li><a href="/sale">Sale</a></li>
  </ul></nav>
  <div class="grid">
    <div class="card"><h3>Shirt A</h3><del>$30</del> <span>$20</span>
      <span aria-label="4.5 out of 5 stars">★★★★½</span><a href="/a">View</a></div>
    <div class="card"><h3>Shirt B</h3><span>1.299,00 €</span><a href="/b">View</a></div>
    <div class="card"><h3>Shirt C</h3><span>$12</span>
      <meta itemprop="ratingValue" content="3.9"><a href="/c">View</a></div>
    <div class="card"><h3>Shirt D</h3><span>Sold out</span><a href="/d">View</a></div>
  </div>`

describe('extract_list', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds the product grid, not the menu, and reads each item', () => {
    document.body.innerHTML = GRID
    const result = String(extractList.run({}, context()))
    const lines = result.split('\n')
    expect(lines[0]).toBe('4 items, showing 4:')
    expect(lines[1]).toMatch(/^\[\d+\] "Shirt A" 20 \$ rating 4.5 href=\/a$/u)
    expect(lines[2]).toContain('"Shirt B" 1299 €')
    expect(lines[3]).toContain('"Shirt C" 12 $ rating 3.9')
    expect(lines[4]).toMatch(/"Shirt D" href=\/d$/u)
  })

  it('sorts by price both ways in code; items without a price go last', () => {
    document.body.innerHTML = GRID
    const titles = (order: string) =>
      String(extractList.run({ sortBy: 'price', order }, context()))
        .split('\n')
        .slice(1)
        .map((line) => line.match(/"(Shirt .)"/u)?.[1])
    expect(titles('asc')).toEqual(['Shirt C', 'Shirt A', 'Shirt B', 'Shirt D'])
    expect(titles('desc')).toEqual(['Shirt B', 'Shirt A', 'Shirt C', 'Shirt D'])
    expect(
      String(extractList.run({ sortBy: 'price', limit: 1 }, context()))
    ).toContain('4 items, by price low to high, showing 1:')
  })

  it('reads the list around a given item and gives refs that click the link', () => {
    document.body.innerHTML = GRID
    const ctx = context()
    const menu = ctx.refs.add(document.querySelector('nav li')!)
    const result = String(extractList.run({ ref: menu }, ctx))
    expect(result).toContain('5 items')
    const ref = Number(result.split('\n')[2].match(/^\[(\d+)\]/u)?.[1])
    expect(ctx.refs.get(ref)?.getAttribute('href')).toBe('/men')
  })

  it('says when there is no list', () => {
    document.body.innerHTML = '<p>Hello</p>'
    expect(extractList.run({}, context())).toBe(
      'No list of repeated items found on the page.'
    )
  })

  it('parses prices in common formats', () => {
    expect(parsePrice('Now 1 299,00 zł')).toEqual({
      amount: 1299,
      currency: 'zł'
    })
    expect(parsePrice('12 €')).toEqual({ amount: 12, currency: '€' })
    expect(parsePrice('USD 1,299')).toEqual({ amount: 1299, currency: 'USD' })
    expect(parsePrice('$12 3 left')).toEqual({ amount: 12, currency: '$' })
    expect(parsePrice('Pack of 3')).toBeNull()
    expect(parseAmount('1.299.000')).toBe(1299000)
    expect(parseAmount('12.5')).toBe(12.5)
  })
})

describe('agent.disabledTools', () => {
  it('lists every tool name in the core entry', () => {
    expect([...AGENT_TOOL_NAMES].sort()).toEqual(
      AGENT_TOOLS.map((tool) => tool.name).sort()
    )
  })

  it('keeps done and fail and drops unknown names', () => {
    expect(DEFAULT_AGENT_OPTIONS.disabledTools).toEqual([])
    expect(
      resolveConfig({
        agent: {
          disabledTools: ['right_click', 'done', 'nope' as 'fail']
        }
      }).agent.disabledTools
    ).toEqual(['right_click'])
    const names = agentTools(true, ['right_click', 'done', 'fail']).map(
      (tool) => tool.name
    )
    expect(names).not.toContain('right_click')
    expect(names).toContain('done')
    expect(names).toContain('fail')
  })

  it('leaves disabled tools out of the prompt, and a call to one is an error', async () => {
    const prompts: string[] = []
    const replies = [
      '{"tool":"find_images","args":{}}',
      '{"tool":"done","args":{"summary":"ok"}}'
    ]
    const fake = fakeAi({
      reply: (input) => {
        prompts.push(promptText(input))
        return replies.shift() ?? '{"tool":"done","args":{"summary":"ok"}}'
      }
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        agent: { disabledTools: ['find_images'] }
      })
    })
    const request: ToolRequest = {
      text: 'Find the plane',
      selection: null,
      framework: 'angular',
      signal: new AbortController().signal,
      onChunk: () => undefined,
      onStatus: () => undefined
    }
    await TestBed.inject(AgentRunnerService).run(request)
    expect(fake.sessions[0].systemPrompt).not.toContain('find_images')
    expect(fake.sessions[0].systemPrompt).toContain('extract_list')
    expect(prompts[1]).toContain('find_images')
    expect(prompts[1]).toMatch(/unknown|not a tool|no tool/iu)
  })
})

describe('prompt size (R7.3)', () => {
  it('keeps the system prompt with every tool under 1,500 tokens', () => {
    const prompt = buildAgentSystemPrompt(agentTools(true))
    console.log(`T-018 system prompt: ${prompt.length} chars`)
    expect(Math.ceil(prompt.length / 4)).toBeLessThan(1_500)
  })
})
