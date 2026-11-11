import { TestBed } from '@angular/core/testing'
import { AiPromptInput, DEFAULT_STRINGS } from 'browse-ai-core'
import {
  fakeAi,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { buildStepPrompt, parseAgentCall } from './agent-protocol'
import { AgentRunnerService } from './agent-runner.service'
import { AGENT_TOOLS, agentTools } from './agent-tools'
import { selectOption, typeText } from './page-actions'
import { RefMap, formatSnapshot, takeSnapshot } from './page-snapshot'
import { sleep, waitFor } from './page-waits'
import { matchesRiskWords, riskOf } from './risk-check'
import type { ToolRequest } from '../../chat/tool-runner'

/** jsdom has no layout; give every element a box in view. */
function stubLayout(): () => void {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    const hidden = (this as HTMLElement).style?.display === 'none'
    const size = hidden ? 0 : 20
    return {
      x: 10,
      y: 10,
      left: 10,
      top: 10,
      right: 10 + size,
      bottom: 10 + size,
      width: size,
      height: size,
      toJSON: () => ({})
    } as DOMRect
  }
  return () => (Element.prototype.getBoundingClientRect = original)
}

function request(
  text: string,
  signal = new AbortController().signal
): ToolRequest {
  return {
    text,
    selection: null,
    framework: 'angular',
    signal,
    onChunk: () => undefined,
    onStatus: () => undefined
  }
}

describe('page waits', () => {
  it('sleep rejects when aborted', async () => {
    const abort = new AbortController()
    const pending = sleep(10_000, abort.signal)
    abort.abort()
    await expect(pending).rejects.toThrow()
  })

  it('waitFor resolves when an element appears and times out otherwise', async () => {
    document.body.innerHTML = ''
    const appear = waitFor({
      doc: document,
      check: () => !!document.querySelector('.done'),
      state: 'visible',
      timeoutMs: 2000
    })
    setTimeout(() => (document.body.innerHTML = '<p class="done">ok</p>'), 20)
    expect(await appear).toBe('appeared')
    expect(
      await waitFor({
        doc: document,
        check: () => false,
        state: 'visible',
        timeoutMs: 50
      })
    ).toBe('timeout')
  })
})

describe('page snapshot', () => {
  let restore: () => void
  beforeEach(() => (restore = stubLayout()))
  afterEach(() => {
    restore()
    document.body.innerHTML = ''
  })

  it('lists visible controls, skips hidden, password and chat elements', () => {
    document.body.innerHTML = `
      <button>Add to cart</button>
      <button style="display:none">Hidden</button>
      <label for="q">Search</label><input id="q" value="shoes" />
      <input type="password" aria-label="Password" />
      <select aria-label="Size"><option>S</option><option selected>M</option></select>
      <div id="chat"><button>Inside chat</button></div>`
    const refs = new RefMap()
    const text = formatSnapshot(
      takeSnapshot(document, document.getElementById('chat'), refs)
    )
    expect(text).toContain('button "Add to cart"')
    expect(text).toContain('input:text "Search" value="shoes"')
    expect(text).toContain('select "Size" value="M" options=S|M')
    expect(text).not.toContain('Hidden')
    expect(text).not.toContain('Password')
    expect(text).not.toContain('Inside chat')
  })

  it('keeps the same ref for an element across snapshots', () => {
    document.body.innerHTML = '<button>One</button><button>Two</button>'
    const refs = new RefMap()
    const first = takeSnapshot(document, null, refs).lines
    const second = takeSnapshot(document, null, refs).lines
    expect(second).toEqual(first)
  })
})

describe('page actions', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('types with input events and picks select options by label', () => {
    document.body.innerHTML =
      '<input id="a" /><select id="s"><option value="1">Small</option><option value="2">Medium</option></select>'
    const input = document.getElementById('a') as HTMLInputElement
    const events: string[] = []
    input.addEventListener('input', () => events.push('input'))
    input.addEventListener('change', () => events.push('change'))
    typeText(input, 'hello')
    expect(input.value).toBe('hello')
    expect(events).toEqual(['input', 'change'])
    const select = document.getElementById('s') as HTMLSelectElement
    expect(selectOption(select, 'medium')).toBe('Medium')
    expect(select.value).toBe('2')
    expect(() => selectOption(select, 'Large')).toThrow(/No option/u)
  })

  it('refuses password fields', () => {
    document.body.innerHTML = '<input type="password" />'
    expect(() => typeText(document.querySelector('input')!, 'x')).toThrow()
  })
})

describe('risk check', () => {
  afterEach(() => (document.body.innerHTML = ''))
  const words = DEFAULT_STRINGS.agentRiskWords

  it('asks before submit buttons, risky words and links that leave the page', () => {
    document.body.innerHTML = `
      <form><input name="q" /><button>Search</button></form>
      <button id="pay">Pay now</button>
      <button id="more">Show more</button>
      <a id="out" href="https://example.org/other">Other</a>
      <a id="hash" href="#top">Top</a>`
    const get = (selector: string) => document.querySelector(selector)
    expect(riskOf('click', get('form button'), document, 'risky', words)).toBe(
      'submit'
    )
    expect(riskOf('click', get('#pay'), document, 'risky', words)).toBe('words')
    expect(riskOf('click', get('#more'), document, 'risky', words)).toBeNull()
    expect(riskOf('click', get('#out'), document, 'risky', words)).toBe(
      'navigate'
    )
    expect(riskOf('click', get('#hash'), document, 'risky', words)).toBeNull()
    expect(riskOf('click', get('#more'), document, 'always', words)).toBe(
      'always'
    )
    expect(riskOf('click', get('#pay'), document, 'never', words)).toBeNull()
    expect(riskOf('scroll', null, document, 'always', words)).toBeNull()
  })

  it('matches whole words only', () => {
    expect(matchesRiskWords('Place order', words)).toBe(true)
    expect(matchesRiskWords('Sending options', words)).toBe(false)
  })
})

describe('agent protocol', () => {
  it('parses a valid call and explains bad ones', () => {
    expect(
      parseAgentCall(
        '```json\n{"thought":"x","tool":"click","args":{"ref":3}}\n```',
        AGENT_TOOLS
      )
    ).toEqual({ thought: 'x', tool: 'click', args: { ref: 3 } })
    expect(parseAgentCall('not json', AGENT_TOOLS)).toEqual({
      error: expect.stringContaining('JSON')
    })
    expect(parseAgentCall('{"tool":"fly","args":{}}', AGENT_TOOLS)).toEqual({
      error: expect.stringContaining('Unknown tool')
    })
    expect(parseAgentCall('{"tool":"click","args":{}}', AGENT_TOOLS)).toEqual({
      error: 'click needs "ref".'
    })
    expect(
      parseAgentCall(
        '{"tool":"scroll","args":{"direction":"left"}}',
        AGENT_TOOLS
      )
    ).toEqual({ error: expect.stringContaining('must be one of') })
  })

  it('keeps user updates in every prompt and marks a new one', () => {
    const prompt = buildStepPrompt({
      task: 'T',
      page: 'P',
      steps: [],
      recap: false,
      updates: ['first', 'second'],
      newUpdate: false
    })
    expect(prompt).toContain('- first\n- second')
    expect(prompt).not.toContain('is new')
  })

  it('leaves screenshot out without screen capture', () => {
    expect(agentTools(false).some((tool) => tool.name === 'screenshot')).toBe(
      false
    )
  })

  it('recaps older steps on one line and keeps the last five in full', () => {
    const steps = Array.from({ length: 7 }, (_, index) => ({
      step: index + 1,
      tool: 'wait',
      args: { ms: 1 },
      status: 'ok' as const,
      result: `line one ${index}\nline two`
    }))
    const prompt = buildStepPrompt({ task: 'T', page: 'P', steps, recap: true })
    expect(prompt).toContain('#1 wait')
    expect(prompt).not.toContain('line one 0\nline two')
    expect(prompt).toContain('line one 6\nline two')
  })
})

describe('AgentRunnerService', () => {
  let restore: () => void
  beforeEach(() => {
    restore = stubLayout()
    document.body.innerHTML = '<button id="go">Next</button><p id="out"></p>'
    document
      .getElementById('go')!
      .addEventListener(
        'click',
        () => (document.getElementById('out')!.textContent = 'clicked')
      )
  })
  afterEach(() => {
    restore()
    document.body.innerHTML = ''
  })

  function setup(
    replies: string[] | ((input: AiPromptInput) => string),
    config = {}
  ) {
    const queue = Array.isArray(replies) ? [...replies] : null
    const reply = Array.isArray(replies)
      ? () => queue?.shift() ?? '{"tool":"done","args":{"summary":"end"}}'
      : replies
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        features: { agentMode: true },
        ...config
      })
    })
    return { fake, agent: TestBed.inject(AgentRunnerService) }
  }

  const refOf = (input: AiPromptInput, name: string): number =>
    Number(
      promptText(input).match(
        new RegExp(`\\[(\\d+)\\] button "${name}"`, 'u')
      )?.[1]
    )

  it('clicks, sees the result and finishes with a summary and step list', async () => {
    const { agent, fake } = setup((input) => {
      const text = promptText(input)
      if (text.includes('This is the first step.'))
        return JSON.stringify({
          tool: 'click',
          args: { ref: refOf(input, 'Next') }
        })
      return '{"tool":"done","args":{"summary":"Clicked Next."}}'
    })
    const result = await agent.run(request('Click next'))
    expect(document.getElementById('out')!.textContent).toBe('clicked')
    expect(result.content).toContain('Clicked Next.')
    expect(result.content).toContain('1. click — Next (ok)')
    expect(fake.sessions[0].systemPrompt).toContain('TOOLS:')
    expect(fake.destroyed).toBe(1)
  })

  it('ends after three bad answers in a row', async () => {
    const { agent } = setup(['nope', 'nope', 'nope'])
    const result = await agent.run(request('x'))
    expect(result.content).toContain(DEFAULT_STRINGS.agentBadAnswers)
  })

  it('stops at the step limit', async () => {
    const { agent } = setup(() => '{"tool":"wait","args":{"ms":1}}', {
      agent: { maxSteps: 2 }
    })
    const result = await agent.run(request('x'))
    expect(result.content).toContain('Stopped after 2 steps')
  })

  it('waits for Allow before a risky click and reports Deny to the model', async () => {
    document.body.innerHTML = '<button id="pay">Pay now</button>'
    let paid = false
    document
      .getElementById('pay')!
      .addEventListener('click', () => (paid = true))
    const prompts: string[] = []
    const { agent } = setup((input) => {
      const text = promptText(input)
      prompts.push(text)
      return prompts.length === 1
        ? JSON.stringify({
            tool: 'click',
            args: { ref: refOf(input, 'Pay now') }
          })
        : '{"tool":"done","args":{"summary":"ok"}}'
    })
    const running = agent.run(request('pay'))
    await vi.waitFor(() => expect(agent.confirmation()).not.toBeNull())
    agent.decide(false)
    await running
    expect(paid).toBe(false)
    expect(prompts[1]).toContain('denied')
  })

  it('asks the user and continues with the answer', async () => {
    const prompts: string[] = []
    const { agent } = setup((input) => {
      prompts.push(promptText(input))
      return prompts.length === 1
        ? '{"tool":"ask_user","args":{"question":"Which size?"}}'
        : '{"tool":"done","args":{"summary":"ok"}}'
    })
    const running = agent.run(request('buy'))
    await vi.waitFor(() => expect(agent.question()).toBe('Which size?'))
    agent.answer('M')
    await running
    expect(prompts[1]).toContain('The user answered: M')
  })

  it('stops when the request is aborted', async () => {
    const abort = new AbortController()
    const { agent } = setup(() => '{"tool":"wait","args":{"ms":5000}}')
    const running = agent.run(request('x', abort.signal))
    await vi.waitFor(() => expect(agent.running()).toBe(true))
    setTimeout(() => abort.abort(), 20)
    const result = await running
    expect(result.content).toContain('Stopped.')
    expect(agent.running()).toBe(false)
  })

  it('reads instructions the user sends while it works', async () => {
    const prompts: string[] = []
    let agentRef: AgentRunnerService | null = null
    const { agent } = setup((input) => {
      prompts.push(promptText(input))
      if (prompts.length === 1) {
        agentRef?.steer('Use the blue one instead')
        return '{"tool":"done","args":{"summary":"early"}}'
      }
      return '{"tool":"done","args":{"summary":"Used the blue one."}}'
    })
    agentRef = agent
    const result = await agent.run(request('Pick the red one'))
    expect(prompts.length).toBe(2)
    expect(prompts[1]).toContain(
      'USER UPDATES (newest last):\n- Use the blue one instead'
    )
    expect(prompts[1]).toContain('The newest update is new.')
    expect(prompts[1]).toContain('before you finished')
    expect(result.content).toContain('Used the blue one.')
    expect(agent.updates()).toEqual(['Use the blue one instead'])
  })

  it('ignores instructions when no run is going', () => {
    const { agent } = setup([])
    agent.steer('hello')
    expect(agent.updates()).toEqual([])
  })
})
