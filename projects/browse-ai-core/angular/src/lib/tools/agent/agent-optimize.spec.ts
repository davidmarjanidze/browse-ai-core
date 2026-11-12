import { TestBed } from '@angular/core/testing'
import { AiPromptInput, AiSession } from 'browse-ai-core'
import {
  fakeAi,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { promptWithSchema } from '../../ai/constrained-prompt'
import type { ToolRequest } from '../../chat/tool-runner'
import {
  MAX_THOUGHT,
  agentResponseSchema,
  agentToolSchema,
  buildAgentSystemPrompt,
  parseAgentCall
} from './agent-protocol'
import { AgentRunnerService } from './agent-runner.service'
import { agentTools } from './agent-tools'
import { AGENT_TUNING } from './agent-tuning'
import { describePage } from './page-diff'
import { PageObserver } from './page-observer'
import {
  PageSnapshot,
  RefMap,
  formatSnapshot,
  takeSnapshot
} from './page-snapshot'
import { IDLE_MS, waitForIdle } from './page-waits'

/** Every element gets a box in view; counts the box reads. */
function stubLayout(): { reads: () => number; restore: () => void } {
  const original = Element.prototype.getBoundingClientRect
  let reads = 0
  Element.prototype.getBoundingClientRect = function () {
    reads++
    const size = (this as HTMLElement).style?.display === 'none' ? 0 : 20
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
  return {
    reads: () => reads,
    restore: () => (Element.prototype.getBoundingClientRect = original)
  }
}

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

const flushObserver = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

let layout: ReturnType<typeof stubLayout>
beforeEach(() => {
  layout = stubLayout()
  document.body.innerHTML =
    '<button id="a">One</button><button id="b">Two</button><input aria-label="Name" />'
})
afterEach(() => {
  layout.restore()
  document.body.innerHTML = ''
})

describe('snapshot layout reads', () => {
  it('reads each element box once', () => {
    takeSnapshot(document, null, new RefMap())
    const interactive = document.querySelectorAll('button, input').length
    expect(layout.reads()).toBe(interactive)
  })
})

describe('PageObserver', () => {
  function observe(host: HTMLElement | null = null) {
    const observer = new PageObserver(document, host, new RefMap())
    observer.start()
    return observer
  }

  it('reuses the snapshot while nothing changes', () => {
    const observer = observe()
    expect(observer.snapshot()).toBe(observer.snapshot())
    observer.stop()
  })

  it('takes a new snapshot after a DOM change, scroll, resize or input', async () => {
    const observer = observe()
    const changes: (() => void)[] = [
      () => document.body.append(document.createElement('button')),
      () => document.dispatchEvent(new Event('scroll')),
      () => window.dispatchEvent(new Event('resize')),
      () =>
        document
          .querySelector('input')!
          .dispatchEvent(new Event('input', { bubbles: true }))
    ]
    for (const change of changes) {
      const before = observer.snapshot()
      change()
      await flushObserver()
      expect(observer.snapshot()).not.toBe(before)
    }
    observer.stop()
  })

  it('ignores changes in the chat element and its own page marks', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const observer = observe(host)
    const before = observer.snapshot()
    host.append(document.createElement('span'))
    const flash = document.createElement('div')
    flash.setAttribute('data-browse-ai-core-flash', '')
    document.documentElement.append(flash)
    flash.remove()
    await flushObserver()
    expect(observer.snapshot()).toBe(before)
    observer.stop()
  })
})

describe('waitForIdle quick settle', () => {
  afterEach(() => vi.useRealTimers())

  it('resolves after the short window when the page stays quiet', async () => {
    vi.useFakeTimers()
    let result = ''
    void waitForIdle(document, 3_000, undefined, 150).then(
      (value) => (result = value)
    )
    await vi.advanceTimersByTimeAsync(160)
    expect(result).toBe('idle')
  })

  it('waits the full window after a change', async () => {
    vi.useFakeTimers()
    let result = ''
    void waitForIdle(document, 3_000, undefined, 150).then(
      (value) => (result = value)
    )
    await vi.advanceTimersByTimeAsync(100)
    document.body.append(document.createElement('p'))
    await vi.advanceTimersByTimeAsync(200)
    expect(result).toBe('')
    await vi.advanceTimersByTimeAsync(IDLE_MS)
    expect(result).toBe('idle')
  })
})

describe('describePage', () => {
  const snap = (refs: RefMap): PageSnapshot =>
    takeSnapshot(document, null, refs)

  it('sends the full list without a base, after a URL change or when asked', () => {
    const refs = new RefMap()
    const before = snap(refs)
    expect(describePage(null, before, { full: false }).text).toContain(
      'ELEMENTS ('
    )
    expect(
      describePage({ ...before, url: 'x' }, before, { full: false }).text
    ).toContain('ELEMENTS (')
    expect(describePage(before, before, { full: true }).text).toContain(
      'ELEMENTS ('
    )
  })

  it('says unchanged when only positions moved', () => {
    const refs = new RefMap()
    const before = snap(refs)
    const moved = {
      ...before,
      items: before.items.map((item) => ({ ...item, at: '@1,1' }))
    }
    const view = describePage(before, moved, { full: false })
    expect(view.text).toContain('Unchanged since the last step')
    expect(view.changed).toBe(false)
  })

  it('lists added, changed and gone elements', () => {
    const refs = new RefMap()
    const before = snap(refs)
    document.getElementById('a')!.remove()
    document.getElementById('b')!.textContent = 'Two more'
    document.body.append(
      Object.assign(document.createElement('button'), { textContent: 'New' })
    )
    const view = describePage(before, snap(refs), { full: false })
    expect(view.text).toContain('+ [4] button "New"')
    expect(view.text).toContain('~ [2] button "Two more"')
    expect(view.text).toContain('- gone: [1]')
  })

  it('never sends changes longer than the full list', () => {
    const refs = new RefMap()
    const after = snap(refs)
    const before = { ...after, items: [] }
    const view = describePage(before, after, { full: false })
    expect(view.text.length).toBeLessThanOrEqual(formatSnapshot(after).length)
    expect(view.changed).toBe(true)
  })
})

describe('agent protocol size and schema', () => {
  const tools = agentTools(true)

  it('lists each tool once on a short line', () => {
    const prompt = buildAgentSystemPrompt(tools, { short: true })
    for (const tool of tools)
      expect(
        prompt.match(new RegExp(`^- ${tool.name}\\b`, 'gmu'))
      ).toHaveLength(1)
    for (const line of prompt
      .split('\n')
      .filter((line) => line.startsWith('- ')))
      expect(line.length).toBeLessThanOrEqual(200)
  })

  it('keeps the 0.7.1 tool lines by default', () => {
    const prompt = buildAgentSystemPrompt(tools)
    expect(prompt).toContain('\nTOOLS:\n')
    expect(prompt).toContain('"ref": number (element number from ELEMENTS)')
    expect(prompt).toContain('Use refs from the latest ELEMENTS list only.')
  })

  it('builds one schema branch per tool with its required args', () => {
    const schema = agentToolSchema(tools) as { anyOf: Record<string, any>[] }
    expect(schema.anyOf).toHaveLength(tools.length)
    const click = schema.anyOf.find(
      (branch) => branch['properties'].tool.enum[0] === 'click'
    )!
    expect(click['properties'].args.required).toEqual(['ref'])
    expect(click['properties'].thought.maxLength).toBe(MAX_THOUGHT)
  })

  it('cuts a long thought', () => {
    const call = parseAgentCall(
      JSON.stringify({
        thought: 'x'.repeat(500),
        tool: 'wait',
        args: { ms: 1 }
      }),
      tools
    )
    expect('thought' in call && call.thought.length).toBe(MAX_THOUGHT)
  })

  it('falls back to the loose schema, then to none', async () => {
    const seen: (object | undefined)[] = []
    const session = {
      prompt: async (
        _: AiPromptInput,
        options?: { responseConstraint?: object }
      ) => {
        seen.push(options?.responseConstraint)
        if (options?.responseConstraint)
          throw Object.assign(new Error('no'), { name: 'NotSupportedError' })
        return 'ok'
      }
    } as unknown as AiSession
    const strict = agentToolSchema(tools)
    const loose = agentResponseSchema(tools)
    const signal = new AbortController().signal
    await promptWithSchema(session, 'x', [strict, loose], signal)
    expect(seen).toEqual([strict, loose, undefined])
    await promptWithSchema(session, 'x', [strict, loose], signal)
    expect(seen.at(-1)).toBeUndefined()
  })
})

describe('AgentRunnerService with page changes', () => {
  function setup(reply: (input: AiPromptInput, index: number) => string) {
    let index = 0
    const prompts: string[] = []
    const fake = fakeAi({
      reply: (input) => {
        prompts.push(promptText(input))
        return reply(input, index++)
      }
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        features: { agentMode: true },
        agent: { confirm: 'never' }
      })
    })
    return { prompts, agent: TestBed.inject(AgentRunnerService) }
  }

  const refOf = (text: string, name: string): number =>
    Number(text.match(new RegExp(`\\[(\\d+)\\] button "${name}"`, 'u'))?.[1])

  it('sends "unchanged" after a read-only step when page diffs are on', async () => {
    AGENT_TUNING.pageDiffs = true
    onTestFinished(() => {
      AGENT_TUNING.pageDiffs = false
    })
    const { agent, prompts } = setup((input, index) =>
      index === 0
        ? JSON.stringify({
            tool: 'read_element',
            args: { ref: refOf(promptText(input), 'One') }
          })
        : '{"tool":"done","args":{"summary":"ok"}}'
    )
    await agent.run(request('read'))
    expect(prompts[0]).toContain('ELEMENTS (')
    expect(prompts[1]).toContain('Unchanged since the last step')
  })

  it('adds a NOTE when the same step does nothing three times', async () => {
    let ref = 0
    const { agent, prompts } = setup((input, index) => {
      if (index === 0) ref = refOf(promptText(input), 'One')
      return index < 3
        ? JSON.stringify({ tool: 'click', args: { ref } })
        : '{"tool":"done","args":{"summary":"ok"}}'
    })
    await agent.run(request('click'))
    expect(prompts[3]).toContain('steps were the same')
    expect(prompts[2]).not.toContain('steps were the same')
  })
})
