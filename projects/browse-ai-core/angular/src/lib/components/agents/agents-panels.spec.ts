import { TestBed } from '@angular/core/testing'
import { fakeAi, flush, provideTestChat } from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { AgentPanelComponent } from './agent-panel.component'
import { WatchPanelComponent } from './watch-panel.component'

async function setup() {
  TestBed.configureTestingModule({
    providers: provideTestChat({
      aiProvider: fakeAi().provider,
      features: { agentMode: true, watchMode: true }
    })
  })
  const session = TestBed.inject(ChatSessionStore)
  TestBed.tick()
  await flush()
  return session
}

const buttons = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('button')].map(
    (button) =>
      button.textContent?.trim() || button.getAttribute('aria-label') || ''
  )

describe('Watch panel', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('offers Select element, then Change and Remove after a pick', async () => {
    const session = await setup()
    const fixture = TestBed.createComponent(WatchPanelComponent)
    const root = fixture.nativeElement as HTMLElement
    fixture.detectChanges()
    expect(root.textContent).toBe('')

    session.selectTool('watch-mode')
    fixture.detectChanges()
    expect(buttons(root)).toEqual(['Select element'])
    expect(root.textContent).toContain('Select an element to watch.')

    document.body.innerHTML = '<b id="x">Open</b>'
    session.watch.picked.set({
      element: document.getElementById('x')!,
      label: 'b#x',
      preview: 'Open',
      tooLong: false
    })
    fixture.detectChanges()
    expect(buttons(root)).toEqual(['Change', 'Remove'])
    expect(root.textContent).toContain('Describe what change to look for.')
  })
})

describe('Agent panel', () => {
  it('shows Allow and Deny for a risky step', async () => {
    const session = await setup()
    const fixture = TestBed.createComponent(AgentPanelComponent)
    const root = fixture.nativeElement as HTMLElement
    session.agent.running.set(true)
    session.agent.confirmation.set({
      tool: 'click',
      target: 'Pay now',
      reason: 'words'
    })
    fixture.detectChanges()
    expect(root.textContent).toContain('Allow this step?')
    expect(root.textContent).toContain('click')
    expect(buttons(root)).toEqual(['Allow', 'Deny'])
  })
})
