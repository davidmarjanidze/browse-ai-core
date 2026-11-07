import { chromeLanguageModelProvider } from './ai-provider'

type LanguageModelGlobal = { LanguageModel?: unknown }

describe('chromeLanguageModelProvider', () => {
  afterEach(() => delete (globalThis as LanguageModelGlobal).LanguageModel)

  it('is unavailable without the LanguageModel API', async () => {
    const provider = chromeLanguageModelProvider()
    expect(await provider.availability()).toBe('unavailable')
    await expect(provider.createSession()).rejects.toThrow()
  })

  it('passes options in the shape Chrome expects', async () => {
    const create = vi.fn(
      async (options: { monitor?: (target: EventTarget) => void }) => {
        const monitor = new EventTarget()
        options.monitor?.(monitor)
        monitor.dispatchEvent(
          Object.assign(new Event('downloadprogress'), { loaded: 0.5 })
        )
        return { prompt: async () => 'ok' }
      }
    )
    ;(globalThis as LanguageModelGlobal).LanguageModel = {
      availability: async () => 'downloadable',
      create
    }
    const progress = vi.fn()
    const provider = chromeLanguageModelProvider()

    expect(await provider.availability()).toBe('downloadable')
    await provider.createSession({
      systemPrompt: 'Be short.',
      initialPrompts: [{ role: 'user', content: 'Hi' }],
      expectedInputs: ['text', 'image'],
      outputLanguage: 'en',
      temperature: 0.3,
      topK: 3,
      onDownloadProgress: progress
    })

    expect(create.mock.calls[0][0]).toMatchObject({
      expectedInputs: [{ type: 'text' }, { type: 'image' }],
      outputLanguage: 'en',
      temperature: 0.3,
      topK: 3,
      initialPrompts: [
        { role: 'system', content: 'Be short.' },
        { role: 'user', content: 'Hi' }
      ]
    })
    expect(progress).toHaveBeenCalledWith(0.5)
  })
})
