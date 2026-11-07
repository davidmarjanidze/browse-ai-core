import { TestBed } from '@angular/core/testing'
import { AiAvailability } from 'browse-ai-core'
import { fakeAi, flush, provideTestChat } from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { BuiltInAiService } from './built-in-ai.service'

interface FakeApi {
  created: object[]
  availability: AiAvailability
}

const GLOBALS = [
  'Summarizer',
  'Translator',
  'Writer',
  'Rewriter',
  'Proofreader',
  'LanguageDetector'
]

function installApi(
  name: string,
  availability: AiAvailability,
  instance: object
): FakeApi {
  const api: FakeApi = { created: [], availability }
  ;(globalThis as Record<string, unknown>)[name] = {
    availability: async () => api.availability,
    create: async (options: { monitor?: (m: EventTarget) => void }) => {
      api.created.push(options)
      const monitor = new EventTarget()
      options.monitor?.(monitor)
      monitor.dispatchEvent(
        Object.assign(new Event('downloadprogress'), { loaded: 1 })
      )
      api.availability = 'available'
      return instance
    }
  }
  return api
}

function stream(...chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk))
      controller.close()
    }
  })
}

async function setup(config = {}) {
  TestBed.configureTestingModule({
    providers: provideTestChat({ aiProvider: fakeAi().provider, ...config })
  })
  const session = TestBed.inject(ChatSessionStore)
  const builtIn = TestBed.inject(BuiltInAiService)
  TestBed.tick()
  await flush()
  return { session, builtIn }
}

describe('BuiltInAiService', () => {
  afterEach(() => {
    for (const name of GLOBALS)
      delete (globalThis as Record<string, unknown>)[name]
  })

  it('lists only tools whose API exists and is not unavailable', async () => {
    installApi('Summarizer', 'available', {})
    installApi('Writer', 'unavailable', {})
    installApi('Translator', 'downloadable', {})
    const { session } = await setup()
    const ids = session.tools().map((tool) => tool.id)
    expect(ids).toContain('summarizer')
    expect(ids).toContain('translator')
    expect(ids).not.toContain('writer')
    expect(ids).not.toContain('rewriter')
    expect(ids).not.toContain('proofreader')
  })

  it('hides a tool when its feature flag is off', async () => {
    installApi('Summarizer', 'available', {})
    const { session } = await setup({ features: { summarizer: false } })
    expect(session.tools().map((tool) => tool.id)).not.toContain('summarizer')
  })

  it('needs a download before sending, then streams only the result', async () => {
    const api = installApi('Summarizer', 'downloadable', {
      summarizeStreaming: () => stream('Short ', 'summary')
    })
    const { session, builtIn } = await setup({
      ai: { builtInTools: { summarizer: { type: 'key-points' } } }
    })
    session.selectTool('summarizer')
    session.prompt.set('Long text')
    expect(session.toolNeedingDownload()).toBe('summarizer')
    expect(session.canSend()).toBe(false)

    await builtIn.download('summarizer')
    expect(builtIn.states().summarizer.availability).toBe('available')
    expect(builtIn.states().summarizer.progress).toBe(100)
    expect(api.created[0]).toMatchObject({
      type: 'key-points',
      format: 'markdown',
      outputLanguage: 'en'
    })
    expect(session.canSend()).toBe(true)

    await session.send()
    expect(session.messages().map((m) => [m.sender, m.content])).toEqual([
      ['user', 'Long text'],
      ['assistant', 'Short summary']
    ])
  })

  it('translates to the picked language from English by default', async () => {
    const api = installApi('Translator', 'available', {
      translate: async (text: string) => `[de] ${text}`
    })
    const { session, builtIn } = await setup()
    session.selectTool('translator')
    builtIn.targetLanguage.set('de')
    await flush()
    session.prompt.set('Hello')
    await session.send()
    expect(api.created[0]).toMatchObject({
      sourceLanguage: 'en',
      targetLanguage: 'de'
    })
    expect(session.messages()[1].content).toBe('[de] Hello')
  })

  it('returns the corrected text from Proofreader', async () => {
    installApi('Proofreader', 'available', {
      proofread: async () => ({ correctedInput: 'I am here.', corrections: [] })
    })
    const { session } = await setup()
    session.selectTool('proofreader')
    session.prompt.set('I is here.')
    await session.send()
    expect(session.messages()[1].content).toBe('I am here.')
  })

  it('shows an error when the text is over the input quota', async () => {
    installApi('Rewriter', 'available', {
      inputQuota: 10,
      measureInputUsage: async () => 20,
      rewrite: async () => 'never'
    })
    const { session } = await setup()
    session.selectTool('rewriter')
    session.prompt.set('Too long')
    await session.send()
    expect(session.messages()[1].content).toBe(session.strings().textTooLong)
  })
})
