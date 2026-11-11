import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { BrowseAiCoreConfig } from 'browse-ai-core'
import { ConfigStore } from '../core/config.store'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../testing/fake-ai'
import { ChatEvents } from './chat-events'
import { ChatSessionStore } from './chat-session.store'
import { EXTRA_TOOLS_OFF } from '../tools/extra-tools'

async function setup(options: Parameters<typeof fakeAi>[0] = {}, config = {}) {
  const fake = fakeAi(options)
  TestBed.configureTestingModule({
    providers: provideTestChat({ aiProvider: fake.provider, ...config })
  })
  const session = TestBed.inject(ChatSessionStore)
  TestBed.tick()
  await flush()
  return { fake, session, events: TestBed.inject(ChatEvents) }
}

describe('ChatSessionStore', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('sends a message and streams the answer', async () => {
    const { session, events } = await setup({ reply: 'Streamed answer' })
    const sent = vi.fn()
    const received = vi.fn()
    events.messageSent.subscribe(sent)
    events.responseReceived.subscribe(received)

    session.prompt.set('Hello')
    await session.send()

    expect(session.messages().map((m) => [m.sender, m.content])).toEqual([
      ['user', 'Hello'],
      ['assistant', 'Streamed answer']
    ])
    expect(session.prompt()).toBe('')
    expect(sent).toHaveBeenCalledWith({
      text: 'Hello',
      hasImage: false,
      hasAudio: false
    })
    expect(received).toHaveBeenCalledWith({ text: 'Streamed answer' })
  })

  it('includes the page only in page mode', async () => {
    document.body.innerHTML = '<p>SECRET PAGE TEXT</p>'
    const { session, fake } = await setup()
    session.prompt.set('a')
    await session.send()
    session.contextMode.set('general')
    session.prompt.set('b')
    await session.send()
    expect(promptText(fake.inputs[0])).toContain('SECRET PAGE TEXT')
    expect(promptText(fake.inputs[1])).not.toContain('SECRET PAGE TEXT')
  })

  it('starts in the configured context mode and resets to it on clear', async () => {
    document.body.innerHTML = '<p>SECRET PAGE TEXT</p>'
    const { session, fake } = await setup({}, { defaultContextMode: 'general' })
    expect(session.contextMode()).toBe('general')
    session.prompt.set('a')
    await session.send()
    expect(promptText(fake.inputs[0])).not.toContain('SECRET PAGE TEXT')

    session.contextMode.set('page')
    expect(session.contextMode()).toBe('page')
    session.clear()
    expect(session.contextMode()).toBe('general')
  })

  it('applies a new default context mode set at runtime', async () => {
    const { session } = await setup()
    expect(session.contextMode()).toBe('page')
    const source = signal<BrowseAiCoreConfig>({ defaultContextMode: 'general' })
    TestBed.inject(ConfigStore).connect(source)
    expect(session.contextMode()).toBe('general')
  })

  it('does not send empty prompts', async () => {
    const { session } = await setup()
    session.prompt.set('   ')
    expect(session.canSend()).toBe(false)
    await session.send()
    expect(session.messages()).toHaveLength(0)
  })

  it('shows errors and emits them', async () => {
    const { session, events } = await setup({
      error: new Error('Model failed')
    })
    const failed = vi.fn()
    events.errorOccurred.subscribe(failed)
    session.prompt.set('Hi')
    await session.send()
    expect(session.messages()[1]).toMatchObject({
      content: 'Model failed',
      error: true
    })
    expect(failed).toHaveBeenCalled()
  })

  it('keeps the partial answer when stopped', async () => {
    const { session } = await setup({
      reply: 'abcdefghijklmnop',
      chunkSize: 2,
      chunkDelay: 5
    })
    session.prompt.set('Hi')
    const sending = session.send()
    await new Promise((resolve) => setTimeout(resolve, 12))
    session.stop()
    await sending
    const answer = session.messages()[1]
    expect(answer.error).toBeFalsy()
    expect(answer.content.length).toBeGreaterThan(0)
    expect(answer.content.length).toBeLessThan(16)
  })

  it('clears the conversation', async () => {
    const { session } = await setup()
    session.prompt.set('Hi')
    await session.send()
    session.clear()
    expect(session.messages()).toEqual([])
  })

  it('extracts tables with the tables tool', async () => {
    document.body.innerHTML =
      '<table><tr><th>A</th></tr><tr><td>1</td></tr></table>'
    const { session } = await setup({
      reply: '[{"title":"T","headers":["A"],"rows":[["1"]]}]'
    })
    session.selectTool('tables-extractor')
    expect(session.canSend()).toBe(true)
    await session.send()
    expect(session.extractedTables()).toEqual([
      { title: 'T', headers: ['A'], rows: [['1']] }
    ])
    expect(session.selectedTool()).toBeNull()
  })

  it('suggests form values and fills them on accept', async () => {
    document.body.innerHTML =
      '<div><label for="n">Name</label><input id="n"></div>'
    const { session } = await setup({
      reply:
        '[{"id":"field_0","type":"text","label":"Name","name":"n","value":"Ana"}]'
    })
    session.selectTool('form-filler')
    session.prompt.set('My name is Ana')
    await session.send()

    expect(session.formSuggestionCount()).toBe(1)
    expect(
      document.querySelector('[data-browse-ai-core-suggestions]')
    ).not.toBeNull()
    session.acceptAllSuggestions()
    expect((document.getElementById('n') as HTMLInputElement).value).toBe('Ana')
    expect(session.formSuggestionCount()).toBe(0)
    expect(
      document.querySelector('[data-browse-ai-core-suggestions]')
    ).toBeNull()
  })

  it('lists only tools turned on in features', async () => {
    const { session } = await setup(
      {},
      {
        features: {
          formFiller: false,
          domToComponent: true,
          ...EXTRA_TOOLS_OFF
        }
      }
    )
    expect(session.tools().map((tool) => tool.id)).toEqual([
      'subject-finder',
      'tables-extractor',
      'image-downloader',
      'dom-to-component'
    ])
  })

  it('needs a picked element and an instruction to start Watch Mode', async () => {
    const { session } = await setup({}, { features: { watchMode: true } })
    document.body.innerHTML = '<span id="p">Price 10</span>'
    session.selectTool('watch-mode')
    session.prompt.set('below 5')
    expect(session.canSend()).toBe(false)
    session.watch.picked.set({
      element: document.getElementById('p')!,
      label: 'span#p',
      preview: 'Price 10',
      tooLong: false
    })
    expect(session.canSend()).toBe(true)
    session.prompt.set(' ')
    expect(session.canSend()).toBe(false)
    session.prompt.set('below 5')
    await session.send()
    expect(session.watch.status()?.label).toBe('span#p')
    expect(session.messages()[0].content).toBe('Watch Mode: span#p\nbelow 5')
    session.clear()
    expect(session.watch.status()).toBeNull()
  })

  it('sends the next message to Agent Mode when it asks a question', async () => {
    let calls = 0
    const { session } = await setup(
      {
        reply: () =>
          ++calls === 1
            ? '{"tool":"ask_user","args":{"question":"Which one?"}}'
            : '{"tool":"done","args":{"summary":"Finished."}}'
      },
      { features: { agentMode: true } }
    )
    session.selectTool('agent-mode')
    session.prompt.set('Do it')
    const running = session.send()
    await vi.waitFor(() => expect(session.agent.question()).toBe('Which one?'))
    expect(session.inputLocked()).toBe(false)
    session.prompt.set('The first')
    expect(session.canSend()).toBe(true)
    await session.send()
    await running
    const contents = session.messages().map((m) => m.content)
    expect(contents[1]).toContain('Which one?')
    expect(contents[2]).toBe('The first')
    expect(contents[3]).toContain('Finished.')
  })

  it('passes messages sent during an Agent Mode run to the agent', async () => {
    let calls = 0
    const { session } = await setup(
      {
        reply: () =>
          ++calls === 1
            ? '{"tool":"wait","args":{"ms":50}}'
            : '{"tool":"done","args":{"summary":"Finished."}}'
      },
      { features: { agentMode: true } }
    )
    session.selectTool('agent-mode')
    session.prompt.set('Do it')
    const running = session.send()
    await vi.waitFor(() => expect(session.agent.running()).toBe(true))
    expect(session.inputLocked()).toBe(false)
    session.prompt.set('Go faster')
    expect(session.canSend()).toBe(true)
    await session.send()
    await running
    expect(session.agent.updates()).toEqual(['Go faster'])
    expect(session.messages().map((m) => m.content)).toContain('Go faster')
  })
})
