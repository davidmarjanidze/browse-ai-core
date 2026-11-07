import { DEFAULT_FEATURES, resolveConfig } from './config'
import { memoryStorageAdapter } from './storage'
import { DEFAULT_STRINGS } from './strings'

describe('resolveConfig', () => {
  it('uses defaults when nothing is passed', () => {
    const config = resolveConfig()
    expect(config.theme).toBe('system')
    expect(config.palette).toBe('indigo')
    expect(config.position).toBe('bottom-right')
    expect(config.mode).toBe('floating')
    expect(config.defaultContextMode).toBe('page')
    expect(config.features).toEqual(DEFAULT_FEATURES)
    expect(config.strings).toEqual(DEFAULT_STRINGS)
    expect(config.ai.outputLanguage).toBe('en')
    expect(config.storageKey).toBe('browse-ai-core')
    expect(config.aiProvider.name).toBe('Gemini Nano')
  })

  it('lets later configs win and merges nested objects key by key', () => {
    const config = resolveConfig(
      {
        palette: 'ocean',
        features: { bookmarks: true },
        strings: { title: 'Help' }
      },
      {
        palette: 'rose',
        features: { formFiller: false },
        ai: { temperature: 0.2 }
      }
    )
    expect(config.palette).toBe('rose')
    expect(config.features.bookmarks).toBe(true)
    expect(config.features.formFiller).toBe(false)
    expect(config.features.markdown).toBe(true)
    expect(config.strings.title).toBe('Help')
    expect(config.strings.send).toBe(DEFAULT_STRINGS.send)
    expect(config.ai).toEqual({ outputLanguage: 'en', temperature: 0.2 })
  })

  it('ignores undefined values so they do not hide earlier ones', () => {
    const config = resolveConfig({ theme: 'dark' }, { theme: undefined })
    expect(config.theme).toBe('dark')
  })

  it('falls back to defaults for unknown values', () => {
    const config = resolveConfig({
      theme: 'blue' as never,
      palette: 'pink' as never,
      position: 'middle' as never,
      mode: 'popup' as never
    })
    expect(config.theme).toBe('system')
    expect(config.palette).toBe('indigo')
    expect(config.position).toBe('bottom-right')
    expect(config.mode).toBe('floating')
  })

  it('keeps custom adapters and allows turning screenshots off', () => {
    const storage = memoryStorageAdapter()
    const config = resolveConfig({ storage, screenCapture: null })
    expect(config.storage).toBe(storage)
    expect(config.screenCapture).toBeNull()
  })

  it('returns the same default adapters every time', () => {
    expect(resolveConfig().aiProvider).toBe(resolveConfig().aiProvider)
    expect(resolveConfig().storage).toBe(resolveConfig().storage)
  })
})

describe('defaultContextMode', () => {
  it('accepts page and general and falls back to page', () => {
    expect(
      resolveConfig({ defaultContextMode: 'general' }).defaultContextMode
    ).toBe('general')
    expect(
      resolveConfig({ defaultContextMode: 'page' }).defaultContextMode
    ).toBe('page')
    expect(
      resolveConfig({ defaultContextMode: 'other' as 'page' })
        .defaultContextMode
    ).toBe('page')
  })
})
