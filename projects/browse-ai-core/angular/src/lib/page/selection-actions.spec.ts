import { TestBed } from '@angular/core/testing'
import { fakeAi, flush, provideTestChat } from '../../../../testing/fake-ai'
import { ChatSessionStore } from '../chat/chat-session.store'
import { PanelStore } from '../core/panel.store'
import { SelectionActionsComponent } from '../components/selection-actions/selection-actions.component'
import { SelectionActionsService } from './selection-actions.service'

function installSummarizer(): void {
  ;(globalThis as Record<string, unknown>)['Summarizer'] = {
    availability: async () => 'available',
    create: async () => ({ summarize: async (text: string) => `Sum: ${text}` })
  }
}

function selectText(element: Element): void {
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}

async function setup(config = {}) {
  TestBed.configureTestingModule({
    providers: provideTestChat({ aiProvider: fakeAi().provider, ...config })
  })
  const fixture = TestBed.createComponent(SelectionActionsComponent)
  const service = TestBed.inject(SelectionActionsService)
  TestBed.tick()
  await flush()
  fixture.detectChanges()
  return { fixture, service, session: TestBed.inject(ChatSessionStore) }
}

describe('Selection actions', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['Summarizer']
    document.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  it('shows actions only for downloaded models and runs the tool', async () => {
    installSummarizer()
    document.body.innerHTML = '<p id="text">Some long page text</p>'
    const { fixture, service, session } = await setup()

    selectText(document.getElementById('text')!)
    expect(service.selection()?.text).toBe('Some long page text')
    fixture.detectChanges()
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Summarize'])

    buttons[0].click()
    await flush()
    expect(TestBed.inject(PanelStore).panel()).toBe('chat')
    expect(session.messages().map((m) => m.content)).toEqual([
      'Some long page text',
      'Sum: Some long page text'
    ])
    expect(service.selection()).toBeNull()
  })

  it('shows nothing when no model is downloaded', async () => {
    document.body.innerHTML = '<p id="text">Text</p>'
    const { fixture } = await setup()
    selectText(document.getElementById('text')!)
    fixture.detectChanges()
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('button')
    ).toBeNull()
  })

  it('ignores selections in fields and hides on Escape', async () => {
    installSummarizer()
    document.body.innerHTML =
      '<div contenteditable="true" id="edit">Edit me</div><p id="text">Text</p>'
    const { service } = await setup()
    selectText(document.getElementById('edit')!)
    expect(service.selection()).toBeNull()

    selectText(document.getElementById('text')!)
    expect(service.selection()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(service.selection()).toBeNull()
  })

  it('stays hidden when the user setting or feature is off', async () => {
    installSummarizer()
    document.body.innerHTML = '<p id="text">Text</p>'
    const { service } = await setup()
    service.setEnabled(false)
    selectText(document.getElementById('text')!)
    expect(service.selection()).toBeNull()
    TestBed.resetTestingModule()

    const off = await setup({ features: { selectionActions: false } })
    selectText(document.getElementById('text')!)
    expect(off.service.selection()).toBeNull()
  })
})
