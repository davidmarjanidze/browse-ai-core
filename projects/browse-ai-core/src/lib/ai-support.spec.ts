import type {
  AiAvailability,
  AiProvider,
  AiSessionOptions
} from './ai-provider'
import {
  getAiAvailability,
  getSessionOptions,
  isAiSupported
} from './ai-support'
import { resolveConfig } from './config'

function provider(
  result: AiAvailability | Error,
  seen: AiSessionOptions[] = []
): AiProvider {
  return {
    name: 'Fake',
    availability: async (options) => {
      seen.push(options ?? {})
      if (result instanceof Error) throw result
      return result
    },
    createSession: async () => ({ prompt: async () => '' })
  }
}

describe('isAiSupported', () => {
  it.each<[AiAvailability, boolean]>([
    ['available', true],
    ['downloadable', true],
    ['downloading', true],
    ['unavailable', false]
  ])('returns %s → %s', async (availability, expected) => {
    expect(await isAiSupported({ aiProvider: provider(availability) })).toBe(
      expected
    )
    expect(
      await getAiAvailability({ aiProvider: provider(availability) })
    ).toBe(availability)
  })

  it('treats a failing check as unsupported', async () => {
    const aiProvider = provider(new Error('boom'))
    expect(await isAiSupported({ aiProvider })).toBe(false)
    expect(await getAiAvailability({ aiProvider })).toBe('unavailable')
  })

  it('checks with the same session options as the chat', async () => {
    const seen: AiSessionOptions[] = []
    const config = {
      aiProvider: provider('available', seen),
      ai: { systemPrompt: 'Be short', temperature: 0.3 },
      features: {
        imageInput: false,
        screenCapture: false,
        audioInput: true
      }
    }
    await isAiSupported(config)
    expect(seen[0]).toEqual(getSessionOptions(resolveConfig(config)))
    expect(seen[0].expectedInputs).toEqual(['text', 'audio'])
    expect(seen[0].systemPrompt).toBe('Be short')
  })
})
