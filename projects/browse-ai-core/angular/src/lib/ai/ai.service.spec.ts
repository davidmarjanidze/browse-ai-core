import { TestBed } from '@angular/core/testing'
import { emptyPageContext } from '../page/page-context.model'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../testing/fake-ai'
import { AiService } from './ai.service'

function setup(options: Parameters<typeof fakeAi>[0] = {}, config = {}) {
  const fake = fakeAi(options)
  TestBed.configureTestingModule({
    providers: provideTestChat({ aiProvider: fake.provider, ...config })
  })
  return { fake, ai: TestBed.inject(AiService) }
}

describe('AiService', () => {
  it('reports availability from the provider', async () => {
    const { ai } = setup({ availability: 'downloadable' })
    TestBed.tick()
    await flush()
    expect(ai.isChecking()).toBe(false)
    expect(ai.isSupported()).toBe(true)
    expect(ai.isModelReady()).toBe(false)
  })

  it('shows a message when the model is unavailable', async () => {
    const { ai } = setup({ availability: 'unavailable' })
    TestBed.tick()
    await flush()
    expect(ai.isSupported()).toBe(false)
    expect(ai.errorMessage()).toContain('not supported')
  })

  it('downloads the model and tracks progress', async () => {
    const { ai } = setup({ availability: 'downloadable' })
    TestBed.tick()
    await flush()
    await ai.downloadModel()
    expect(ai.isModelReady()).toBe(true)
    expect(ai.downloadProgress()).toBe(100)
  })

  it('streams an answer and passes AI options to the session', async () => {
    const { ai, fake } = setup(
      { reply: 'Hello world' },
      { ai: { systemPrompt: 'Be short', temperature: 0.5 } }
    )
    TestBed.tick()
    await flush()
    const chunks: string[] = []
    const answer = await ai.prompt({
      userPrompt: 'Hi',
      onChunk: (c) => chunks.push(c)
    })
    expect(answer).toBe('Hello world')
    expect(chunks.join('')).toBe('Hello world')
    expect(fake.sessions[0]).toMatchObject({
      systemPrompt: 'Be short',
      temperature: 0.5
    })
    expect(fake.destroyed).toBe(1)
    expect(ai.isGenerating()).toBe(false)
  })

  it('keeps the shared session and reports context usage', async () => {
    const { ai, fake } = setup()
    TestBed.tick()
    await flush()
    await ai.prompt({ userPrompt: 'a', useSharedSession: true })
    await ai.prompt({ userPrompt: 'b', useSharedSession: true })
    expect(fake.sessions).toHaveLength(1)
    expect(ai.contextUsage().percentage).toBe(25)
    ai.resetSession()
    expect(ai.contextUsage().percentage).toBe(0)
  })

  it('cuts the page text and retries after a quota error', async () => {
    let calls = 0
    const { ai } = setup({
      reply: () => {
        calls += 1
        if (calls < 3) throw new DOMException('too big', 'QuotaExceededError')
        return 'ok'
      }
    })
    TestBed.tick()
    await flush()
    const result = await ai.promptWithQuotaRetry({
      userPrompt: 'Summarize',
      page: { ...emptyPageContext(), mainText: 'x'.repeat(100) },
      includePageContext: true,
      reductionStep: 10
    })
    expect(result).toEqual({ content: 'ok', reductionPercent: 20 })
  })

  it('refuses to prompt before the model is ready', async () => {
    const { ai } = setup({ availability: 'downloadable' })
    TestBed.tick()
    await flush()
    await expect(ai.prompt({ userPrompt: 'Hi' })).rejects.toThrow(
      'Download the model'
    )
  })

  it('sends images as multimodal content', async () => {
    const { ai, fake } = setup()
    TestBed.tick()
    await flush()
    await ai.prompt({
      userPrompt: 'What is this?',
      imageData: 'data:image/png;base64,AA=='
    })
    const input = fake.inputs[0]
    expect(Array.isArray(input)).toBe(true)
    expect(promptText(input)).toContain('What is this?')
  })
})
