import { TestBed } from '@angular/core/testing'
import { DEFAULT_STRINGS } from 'browse-ai-core'
import { fakeAi, flush, provideTestChat } from '../../../../testing/fake-ai'
import { ChatSessionStore } from '../chat/chat-session.store'
import { ChatMessage } from '../chat/chat.model'
import { ChatHeaderComponent } from '../components/header/chat-header.component'
import { ComposerToolbarComponent } from '../components/composer/composer-toolbar.component'
import { ToolCardComponent } from '../components/tool-card/tool-card.component'
import { PanelStore } from '../core/panel.store'
import { NotesService } from './notes/notes.service'
import { EXTRA_TOOLS, EXTRA_TOOLS_OFF } from './extra-tools'

async function setup(config = {}) {
  TestBed.configureTestingModule({
    providers: provideTestChat({ aiProvider: fakeAi().provider, ...config })
  })
  const session = TestBed.inject(ChatSessionStore)
  TestBed.tick()
  await flush()
  return session
}

/** Agent Mode and Watch Mode are off by default. */
const ALL_ON = { features: { agentMode: true, watchMode: true } }

describe('newer tools', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('are listed when on and hidden when off', async () => {
    const session = await setup(ALL_ON)
    const ids = session.tools().map((tool) => tool.id)
    for (const tool of EXTRA_TOOLS) expect(ids).toContain(tool.id)
    TestBed.resetTestingModule()
    const off = await setup({ features: EXTRA_TOOLS_OFF })
    expect(
      off
        .tools()
        .some((tool) => EXTRA_TOOLS.some((extra) => extra.id === tool.id))
    ).toBe(false)
  })

  it('each show the green help box with their steps', async () => {
    const session = await setup(ALL_ON)
    const fixture = TestBed.createComponent(ComposerToolbarComponent)
    for (const tool of EXTRA_TOOLS) {
      session.selectTool(tool.id)
      fixture.detectChanges()
      const box = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="note"]'
      )!
      expect(box.className).toContain('bg-bac-accent-soft')
      const name = DEFAULT_STRINGS[`${tool.key}Name`]
      expect(box.textContent).toContain(`How to use ${name}`)
      const steps = DEFAULT_STRINGS[`${tool.key}Notes`]
      expect(steps.length).toBeGreaterThanOrEqual(2)
      expect(steps.length).toBeLessThanOrEqual(4)
      expect(box.querySelectorAll('li').length).toBe(steps.length)
    }
  })
})

describe('Notes in the header', () => {
  it('opens Notes from the menu and the back arrow goes up one level at a time', async () => {
    await setup()
    const fixture = TestBed.createComponent(ChatHeaderComponent)
    const header = fixture.componentInstance
    expect(header.menuItems().map((item) => item.value)).toContain('notes')
    const panel = TestBed.inject(PanelStore)
    const notes = TestBed.inject(NotesService)
    header.onMenu('notes')
    expect(panel.panel()).toBe('notes')
    expect(header.title()).toBe('Notes')
    notes.view.set({ level: 'notes', host: 'a.test', url: 'https://a.test/' })
    header.back()
    expect(notes.view().level).toBe('pages')
    header.back()
    expect(notes.view().level).toBe('sites')
    header.back()
    expect(panel.panel()).toBe('chat')
  })

  it('hides the Notes item when notes is off', async () => {
    await setup({ features: { notes: false } })
    const fixture = TestBed.createComponent(ChatHeaderComponent)
    expect(
      fixture.componentInstance.menuItems().map((item) => item.value)
    ).not.toContain('notes')
  })
})

describe('ToolCardComponent', () => {
  const message = (card: ChatMessage['card'], content = ''): ChatMessage => ({
    id: 'm1',
    sender: 'assistant',
    content,
    timestamp: new Date(),
    card
  })

  async function render(card: ChatMessage['card'], content = '') {
    await setup()
    const fixture = TestBed.createComponent(ToolCardComponent)
    fixture.componentRef.setInput('message', message(card, content))
    fixture.detectChanges()
    return { fixture, root: fixture.nativeElement as HTMLElement }
  }

  it('shows grouped links that open in a new tab', async () => {
    const { root } = await render({
      kind: 'links',
      matched: false,
      links: [
        {
          id: 0,
          url: 'https://a.test/x',
          text: 'X',
          group: 'internal',
          count: 3
        },
        { id: 1, url: '#', text: 'Bad', group: 'suspicious', count: 1 }
      ]
    })
    expect(root.textContent).toContain('Internal (1)')
    expect(root.textContent).toContain('Suspicious (1)')
    expect(root.textContent).toContain('3 times')
    const link = root.querySelector('a')!
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')
    expect(root.querySelectorAll('a').length).toBe(1)
  })

  it('shows rating bars, phishing level and dark pattern actions', async () => {
    const reviews = await render({
      kind: 'reviews',
      stats: { count: 3, rated: 3, average: 4, perStar: [0, 0, 1, 0, 2] }
    })
    expect(reviews.root.textContent).toContain('Rating breakdown')
    expect(reviews.root.textContent).toContain('5 stars')
    TestBed.resetTestingModule()
    const phishing = await render({
      kind: 'phishing',
      level: 'high',
      signals: [{ id: 'urgent-text', text: 'Pressure wording' }]
    })
    expect(
      phishing.root.querySelector('[role="status"]')?.textContent
    ).toContain('High risk')
    TestBed.resetTestingModule()
    const patterns = await render({
      kind: 'dark-patterns',
      findings: [
        {
          n: 1,
          type: 'prechecked',
          evidence: 'Newsletter',
          why: 'Already on',
          canUncheck: true
        }
      ]
    })
    expect(patterns.root.textContent).toContain('Pre-checked box')
    expect(patterns.root.textContent).toContain('Uncheck')
  })

  it('asks before replacing text in the reply box', async () => {
    document.body.innerHTML = '<textarea id="box">Old</textarea>'
    const { fixture, root } = await render(
      { kind: 'reply', fieldLabel: 'box' },
      'New reply'
    )
    const tools = fixture.componentInstance.tools
    ;(document.getElementById('box') as HTMLTextAreaElement).focus()
    // The drafter remembers the box when it runs; set it the same way here.
    await tools.reply.run({
      text: '',
      selection: null,
      framework: 'angular',
      signal: new AbortController().signal,
      onChunk: () => undefined,
      onStatus: () => undefined
    })
    ;[...root.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Insert'))!
      .click()
    fixture.detectChanges()
    expect(root.textContent).toContain(
      'Replace it or add the draft at the end?'
    )
    ;[...root.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Replace'))!
      .click()
    expect((document.getElementById('box') as HTMLTextAreaElement).value).toBe(
      'New reply'
    )
  })
})
