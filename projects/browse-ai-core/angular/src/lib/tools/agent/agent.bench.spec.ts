import { TestBed } from '@angular/core/testing'
import {
  AgentToolName,
  AiPromptInput,
  AiProvider,
  AiSession
} from 'browse-ai-core'
import { promptText, provideTestChat } from '../../../../../testing/fake-ai'
import type { ToolRequest } from '../../chat/tool-runner'
import { AgentRunnerService } from './agent-runner.service'
import { AGENT_TUNING } from './agent-tuning'

/**
 * Benchmark for T-011. Scripted runs on fixed pages with a fake model that
 * counts what it is sent. Gemini Nano's context is about 6k tokens; the fake
 * counts 4 characters per token.
 */
const CONTEXT_TOKENS = 6_144
const tokens = (text: string): number => Math.ceil(text.length / 4)

interface Stats {
  calls: number
  systemChars: number
  stepChars: number
  answerChars: number
  restarts: number
  walks: number
  boxReads: number
  styleReads: number
  pageMs: number
  status: string
}

/** A step of the script: the tool call, given every ref seen so far. */
type Step = (refs: Map<string, number>) => {
  tool: string
  args: Record<string, unknown>
}

function scriptedModel(steps: Step[], stats: Stats): AiProvider {
  const refs = new Map<string, number>()
  let index = 0
  let sessions = 0
  return {
    name: 'Bench model',
    downloadSize: '1 GB',
    availability: async () => 'available',
    createSession: async (options = {}) => {
      if (sessions++) stats.restarts++
      stats.systemChars += options.systemPrompt?.length ?? 0
      const session: AiSession = {
        contextUsage: tokens(options.systemPrompt ?? ''),
        contextWindow: CONTEXT_TOKENS,
        prompt: async (input: AiPromptInput) => {
          const text = promptText(input)
          const used = session.contextUsage! + tokens(text)
          if (used > CONTEXT_TOKENS)
            throw new DOMException('too large', 'QuotaExceededError')
          stats.calls++
          stats.stepChars += text.length
          for (const match of text.matchAll(/\[(\d+)\] \w+ "([^"]*)"/gu))
            refs.set(match[2], Number(match[1]))
          const step = steps[index++] ?? (() => ({ tool: 'done', args: {} }))
          const answer = JSON.stringify({
            thought: 'Next step.',
            ...step(refs)
          })
          stats.answerChars += answer.length
          session.contextUsage = used + tokens(answer)
          return answer
        },
        // eslint-disable-next-line require-yield
        async *promptStreaming() {
          throw new Error('not used')
        },
        destroy: () => undefined
      }
      return session
    }
  }
}

/** Gives elements a layout and counts layout reads, style reads and walks. */
function instrument(stats: Stats): () => void {
  const box = Element.prototype.getBoundingClientRect
  const style = window.getComputedStyle
  const all = Document.prototype.querySelectorAll
  Element.prototype.getBoundingClientRect = function () {
    const start = performance.now()
    stats.boxReads++
    const hidden = (this as HTMLElement).style?.display === 'none'
    const size = hidden ? 0 : 20
    const order = Number((this as HTMLElement).dataset?.['row'] ?? 0)
    const top = 10 + order * 24
    stats.pageMs += performance.now() - start
    return {
      x: 10,
      y: top,
      left: 10,
      top,
      right: 10 + size,
      bottom: top + size,
      width: size,
      height: size,
      toJSON: () => ({})
    } as DOMRect
  }
  window.getComputedStyle = function (...args) {
    const start = performance.now()
    stats.styleReads++
    const result = style.apply(window, args)
    stats.pageMs += performance.now() - start
    return result
  }
  Document.prototype.querySelectorAll = function (
    this: Document,
    selector: string
  ) {
    if (selector === '*') stats.walks++
    return all.call(this, selector)
  } as typeof all
  return () => {
    Element.prototype.getBoundingClientRect = box
    window.getComputedStyle = style
    Document.prototype.querySelectorAll = all
  }
}

function shopPage(): void {
  const products = Array.from(
    { length: 40 },
    (_, index) => `
      <div class="card" data-row="${index + 2}">
        <a href="#p${index}" data-row="${index + 2}">${index % 3 ? 'Blue' : 'Red'} shirt ${index}</a>
        <select aria-label="Size ${index}" data-row="${index + 2}">
          <option>S</option><option>M</option><option>L</option>
        </select>
        <button data-add="${index}" data-row="${index + 2}">Add to cart ${index}</button>
      </div>`
  ).join('')
  const footer = Array.from(
    { length: 20 },
    (_, index) =>
      `<a href="#f${index}" data-row="${index + 50}">Footer link ${index}</a>`
  ).join('')
  document.body.innerHTML = `
    <input aria-label="Search" data-row="0" />
    <button id="search" data-row="0">Search</button>
    <button id="cart" data-row="1">Cart (0)</button>
    <main>${products}</main><footer>${footer}</footer>`
  let count = 0
  document.getElementById('search')!.addEventListener('click', () => {
    const query = (document.querySelector('input') as HTMLInputElement).value
    for (const card of document.querySelectorAll<HTMLElement>('.card'))
      card.style.display = card.textContent!.toLowerCase().includes(query)
        ? ''
        : 'none'
  })
  for (const button of document.querySelectorAll('[data-add]'))
    button.addEventListener('click', () => {
      document.getElementById('cart')!.textContent = `Cart (${++count})`
    })
}

function listPage(): void {
  const items = Array.from(
    { length: 200 },
    (_, index) =>
      `<li><a href="#i${index}" data-row="${index + 1}">Item ${index}</a></li>`
  ).join('')
  document.body.innerHTML = `<button id="more" data-row="0">Load more</button><ul>${items}</ul>`
  document.getElementById('more')!.addEventListener('click', () => {
    const list = document.querySelector('ul')!
    for (let index = 0; index < 5; index++)
      list.insertAdjacentHTML(
        'afterbegin',
        `<li><a href="#n${index}" data-row="0">New item ${index}</a></li>`
      )
  })
}

const shopSteps: Step[] = [
  (refs) => ({
    tool: 'type_text',
    args: { ref: refs.get('Search'), text: 'red' }
  }),
  (refs) => ({ tool: 'click', args: { ref: refs.get('Search') } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Red shirt 3') } }),
  (refs) => ({
    tool: 'select_option',
    args: { ref: refs.get('Size 3'), value: 'M' }
  }),
  (refs) => ({ tool: 'click', args: { ref: refs.get('Add to cart 3') } }),
  () => ({ tool: 'find_text', args: { text: 'Cart' } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Cart (1)') } }),
  (refs) => ({
    tool: 'select_option',
    args: { ref: refs.get('Size 6'), value: 'L' }
  }),
  (refs) => ({ tool: 'click', args: { ref: refs.get('Add to cart 6') } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Cart (2)') } }),
  () => ({ tool: 'done', args: { summary: 'Added two red shirts.' } })
]

const listSteps: Step[] = [
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Item 3') } }),
  () => ({ tool: 'find_text', args: { text: 'Item 150' } }),
  (refs) => ({ tool: 'click', args: { ref: refs.get('Load more') } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('New item 0') } }),
  () => ({ tool: 'wait', args: { ms: 1 } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Item 10') } }),
  () => ({ tool: 'remember', args: { note: 'Item 10 checked.' } }),
  (refs) => ({ tool: 'read_element', args: { ref: refs.get('Item 20') } }),
  () => ({ tool: 'done', args: { summary: 'Read the list.' } })
]

function request(text: string): ToolRequest {
  return {
    text,
    selection: null,
    framework: 'angular',
    signal: new AbortController().signal,
    onChunk: () => undefined,
    onStatus: () => undefined
  }
}

/** Tools added after the baseline (T-018), left out to compare like with like. */
const T018_TOOLS: AgentToolName[] = [
  'find_images',
  'extract_list',
  'read_selection',
  'set_value',
  'close_overlay',
  'right_click',
  'wait_for_url',
  'go_forward'
]

async function bench(
  page: () => void,
  steps: Step[],
  disabledTools: AgentToolName[] = T018_TOOLS
): Promise<Stats> {
  const stats: Stats = {
    calls: 0,
    systemChars: 0,
    stepChars: 0,
    answerChars: 0,
    restarts: 0,
    walks: 0,
    boxReads: 0,
    styleReads: 0,
    pageMs: 0,
    status: ''
  }
  page()
  const restore = instrument(stats)
  try {
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: scriptedModel(steps, stats),
        features: { agentMode: true },
        agent: { confirm: 'never', disabledTools }
      })
    })
    const agent = TestBed.inject(AgentRunnerService)
    const result = await agent.run(request('bench'))
    stats.status = result.content.split('\n')[0]
  } finally {
    restore()
    document.body.innerHTML = ''
  }
  stats.pageMs = Math.round(stats.pageMs)
  return stats
}

/**
 * Numbers measured on the code before T-011 (2026-11-12). `sent` is the
 * system prompts plus the step prompts; `system` is one system prompt.
 */
const BASELINE = {
  shop: { sent: 97_960, system: 5_004, restarts: 4 },
  list: { sent: 35_284, system: 5_004, restarts: 1 }
}

/** R2.5 and R3.2: at least 40% fewer characters, a 30% shorter system prompt. */
function checkTargets(stats: Stats, baseline: (typeof BASELINE)['shop']): void {
  const sessions = stats.restarts + 1
  expect(stats.systemChars + stats.stepChars).toBeLessThanOrEqual(
    baseline.sent * 0.6
  )
  expect(stats.systemChars / sessions).toBeLessThanOrEqual(
    baseline.system * 0.7
  )
  expect(stats.restarts).toBeLessThanOrEqual(baseline.restarts)
}

describe('Agent Mode benchmark (T-011)', () => {
  const results: Record<string, Stats> = {}
  const defaults = { ...AGENT_TUNING }

  // Measures the T-011 path; the switches are off by default.
  beforeAll(() => {
    for (const key of Object.keys(
      AGENT_TUNING
    ) as (keyof typeof AGENT_TUNING)[])
      AGENT_TUNING[key] = true
  })
  afterAll(() => Object.assign(AGENT_TUNING, defaults))

  afterAll(() => {
    console.log(`T-011 bench ${JSON.stringify(results)}`)
  })

  it('shop flow', async () => {
    results['shop'] = await bench(shopPage, shopSteps)
    expect(results['shop'].status).toContain('Added two red shirts.')
    checkTargets(results['shop'], BASELINE.shop)
  }, 30_000)

  it('long list', async () => {
    results['list'] = await bench(listPage, listSteps)
    expect(results['list'].status).toContain('Read the list.')
    checkTargets(results['list'], BASELINE.list)
  }, 30_000)

  // T-018 R7.3: with every tool on, the shop flow still fits Nano's context.
  it('shop flow with every tool', async () => {
    results['shopAllTools'] = await bench(shopPage, shopSteps, [])
    const stats = results['shopAllTools']
    expect(stats.status).toContain('Added two red shirts.')
    expect(stats.restarts).toBe(0)
    expect(tokens('x'.repeat(stats.systemChars))).toBeLessThan(
      CONTEXT_TOKENS / 4
    )
  }, 30_000)
})
