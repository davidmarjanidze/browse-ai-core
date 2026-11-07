import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { memoryStorageAdapter } from 'browse-ai-core'
import { provideTestChat } from '../../../../testing/fake-ai'
import { ConfigStore } from './config.store'
import { ThemeStore } from './theme.store'

describe('ThemeStore', () => {
  function setup(config = {}) {
    TestBed.configureTestingModule({
      providers: provideTestChat({ storage: memoryStorageAdapter(), ...config })
    })
    return TestBed.inject(ThemeStore)
  }

  it('uses the config theme and palette', () => {
    const theme = setup({ theme: 'dark', palette: 'ocean' })
    expect(theme.mode()).toBe('dark')
    expect(theme.palette()).toBe('ocean')
    expect(theme.css()).toContain('--bac-primary:#38bdf8')
  })

  it('lets a saved choice win over the config', async () => {
    const theme = setup({ theme: 'dark' })
    theme.setTheme('light')
    theme.setPalette('rose')
    expect(theme.mode()).toBe('light')
    expect(theme.palette()).toBe('rose')
  })

  it('ignores saved choices when appearance is turned off', async () => {
    const theme = setup({ theme: 'dark', features: { appearance: false } })
    theme.setTheme('light')
    expect(theme.mode()).toBe('dark')
  })

  it('follows the config when the component input changes', () => {
    const theme = setup()
    const input = signal({ theme: 'light' as const })
    TestBed.inject(ConfigStore).connect(input)
    expect(theme.mode()).toBe('light')
  })
})
