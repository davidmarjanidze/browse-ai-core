import { Component, signal } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import {
  BrowseAiCoreConfig,
  ChatMode,
  PaletteName,
  ThemeMode,
  memoryStorageAdapter
} from 'browse-ai-core'
import { fakeAi, flush } from '../../../testing/fake-ai'
import { BrowseAiCoreComponent } from './browse-ai-core.component'
import { BROWSE_AI_CORE_CONFIG } from './core/config.store'
import { EXTRA_TOOLS_OFF } from './tools/extra-tools'

@Component({
  imports: [BrowseAiCoreComponent],
  template: `
    <browse-ai-core
      [config]="config()"
      [mode]="mode()"
      [theme]="theme()"
      [palette]="palette()"
      [(open)]="open"
      (opened)="events.push('opened')"
      (closed)="events.push('closed')"
      (messageSent)="events.push('sent')"
      (responseReceived)="events.push('received')"
    >
      <span slot="header" class="custom-header">Support</span>
      <p slot="empty-state" class="custom-empty">Ask us anything</p>
    </browse-ai-core>
  `
})
class HostComponent {
  readonly config = signal<BrowseAiCoreConfig>({})
  readonly mode = signal<ChatMode | undefined>(undefined)
  readonly theme = signal<ThemeMode | undefined>(undefined)
  readonly palette = signal<PaletteName | undefined>(undefined)
  readonly open = signal(false)
  readonly events: string[] = []
}

describe('BrowseAiCoreComponent', () => {
  let fixture: ComponentFixture<HostComponent>
  let host: HostComponent

  const root = (): ShadowRoot =>
    fixture.nativeElement.querySelector('browse-ai-core').shadowRoot
  const query = <T extends Element = HTMLElement>(selector: string): T | null =>
    root().querySelector<T>(selector)
  const settle = async (): Promise<void> => {
    await flush()
    await fixture.whenStable()
    await flush()
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: BROWSE_AI_CORE_CONFIG,
          useValue: {
            aiProvider: fakeAi({ reply: 'Answer' }).provider,
            storage: memoryStorageAdapter(),
            screenCapture: null
          }
        }
      ]
    })
    fixture = TestBed.createComponent(HostComponent)
    host = fixture.componentInstance
    await settle()
  })

  it('renders the launcher with an accessible label', () => {
    const launcher = query('[part="launcher"]')!
    expect(launcher.getAttribute('aria-label')).toBe('Open AI chat')
    expect(query('[part="panel"]')).toBeNull()
  })

  it('opens on click and closes with Escape', async () => {
    query<HTMLButtonElement>('[part="launcher"]')!.click()
    await settle()
    const panel = query('[part="panel"]')!
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(host.open()).toBe(true)

    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    await settle()
    expect(query('[part="panel"]')).toBeNull()
    expect(host.open()).toBe(false)
    expect(host.events).toEqual(['opened', 'closed'])
  })

  it('opens when the open input is set', async () => {
    host.open.set(true)
    await settle()
    expect(query('[part="panel"]')).not.toBeNull()
  })

  it('makes the launcher see-through until hover or focus', () => {
    const css = [...root().querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('')
      .replace(/\s+/g, '')
    expect(css).toContain('--bac-launcher-opacity:0.5')
    expect(css).toContain('opacity:var(--bac-launcher-opacity)')
    expect(css).toMatch(
      /\.bac-launcher:hover,\.bac-launcher:focus-within\{opacity:1/
    )
    expect(css).toContain('transition:opacity200msease')
  })

  it('renders inline without a launcher or close button', async () => {
    host.mode.set('inline')
    await settle()
    expect(query('[part="launcher"]')).toBeNull()
    expect(query('[part="panel"]')!.getAttribute('role')).toBe('region')
    expect(query('[aria-label="Close assistant"]')).toBeNull()
    expect(
      fixture.nativeElement
        .querySelector('browse-ai-core')
        .getAttribute('data-layout')
    ).toBe('inline')
  })

  it('projects slot content', async () => {
    host.open.set(true)
    await settle()
    expect(query('.custom-header')?.textContent).toBe('Support')
    expect(query('.custom-empty')?.textContent).toBe('Ask us anything')
  })

  it('uses custom strings', async () => {
    host.config.set({ strings: { openChat: 'Help', title: 'Support bot' } })
    await settle()
    expect(query('[part="launcher"]')!.getAttribute('aria-label')).toBe('Help')
    host.open.set(true)
    await settle()
    expect(query('h2')?.textContent?.trim()).toBe('Support bot')
  })

  it('hides features that are turned off', async () => {
    host.config.set({
      features: {
        pageContext: false,
        formFiller: false,
        tablesExtractor: false,
        imageDownloader: false,
        subjectFinder: false,
        ...EXTRA_TOOLS_OFF
      }
    })
    host.open.set(true)
    await settle()
    expect(query('bac-toggle-group')).toBeNull()
    expect(query('bac-select')).toBeNull()

    host.config.set({})
    await settle()
    expect(query('bac-toggle-group')).not.toBeNull()
    expect(query('bac-select')).not.toBeNull()
  })

  it('applies the theme and palette', async () => {
    host.theme.set('dark')
    host.palette.set('teal')
    await settle()
    const css = root().getElementById('bac-theme')!.textContent!
    expect(css).toContain('--bac-primary:#2dd4bf')
    expect(css).toContain('color-scheme:dark')
  })

  it('sends a message from the composer', async () => {
    host.open.set(true)
    await settle()
    const textarea = query<HTMLTextAreaElement>('textarea')!
    textarea.value = 'Hello'
    textarea.dispatchEvent(new Event('input'))
    await settle()
    query<HTMLButtonElement>('[part="send-button"]')!.click()
    await settle()
    await settle()
    expect(query('[part="message-user"]')?.textContent?.trim()).toBe('Hello')
    expect(query('[part="message-assistant"]')?.textContent?.trim()).toBe(
      'Answer'
    )
    expect(host.events).toContain('sent')
    expect(host.events).toContain('received')
  })

  it('gives every icon button a label', async () => {
    host.open.set(true)
    await settle()
    const unlabeled = Array.from(root().querySelectorAll('button')).filter(
      (button) =>
        !button.textContent?.trim() && !button.getAttribute('aria-label')
    )
    expect(unlabeled).toEqual([])
  })
})
