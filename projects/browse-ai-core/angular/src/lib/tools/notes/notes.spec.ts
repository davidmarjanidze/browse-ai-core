import { TestBed } from '@angular/core/testing'
import { memoryStorageAdapter } from 'browse-ai-core'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { NotesPanelComponent } from '../../components/notes/notes-panel.component'
import {
  NoteRecord,
  addNotes,
  deleteNote,
  deletePage,
  listPages,
  listSites,
  normalizeNotes,
  pageKey,
  pageToMarkdown,
  searchPages,
  siteKey
} from '../../core/notes-data'
import { PanelStore } from '../../core/panel.store'
import { findTextRange, textAround } from '../../page/find-text-range'
import { NotesService, parseNotes } from './notes.service'

const note = (id: string, extra: Partial<NoteRecord> = {}): NoteRecord => ({
  id,
  quote: '',
  note: `Note ${id}`,
  before: '',
  after: '',
  createdAt: '2026-11-07T10:00:00.000Z',
  ...extra
})

describe('notes data', () => {
  const a = { url: 'https://www.example.com/a#top', title: 'Guide' }
  const b = { url: 'https://example.com/b', title: 'Guide' }
  const c = { url: 'https://other.org/', title: '' }

  it('groups pages by site without www and keys pages without the hash', () => {
    expect(siteKey(a.url)).toBe('example.com')
    expect(pageKey(a.url)).toBe('https://www.example.com/a')
    let data = addNotes({}, a, [note('1')], '2026-11-01')
    data = addNotes(data, a, [note('2')], '2026-11-02')
    data = addNotes(data, b, [note('3')], '2026-11-03')
    data = addNotes(data, c, [note('4')], '2026-11-04')
    expect(
      listSites(data).map((site) => [site.host, site.pageCount, site.noteCount])
    ).toEqual([
      ['other.org', 1, 1],
      ['example.com', 2, 3]
    ])
    expect(listPages(data, 'example.com').map((page) => page.url)).toEqual([
      'https://example.com/b',
      'https://www.example.com/a'
    ])
    expect(data['example.com']['https://www.example.com/a'].title).toBe('Guide')
  })

  it('deletes notes and drops empty pages and sites', () => {
    let data = addNotes({}, b, [note('1'), note('2')])
    data = deleteNote(data, pageKey(b.url), '1')
    expect(data['example.com'][b.url].notes.map((n) => n.id)).toEqual(['2'])
    data = deleteNote(data, pageKey(b.url), '2')
    expect(data).toEqual({})
    data = deletePage(addNotes({}, b, [note('1')]), pageKey(b.url))
    expect(data).toEqual({})
  })

  it('searches titles, quotes and notes, and drops bad stored data', () => {
    const data = addNotes({}, b, [
      note('1', { quote: 'Battery life is great' })
    ])
    expect(searchPages(data, 'battery').length).toBe(1)
    expect(searchPages(data, 'nothing').length).toBe(0)
    expect(
      normalizeNotes({
        'x.com': { 'https://x.com/': { notes: [{ bad: 1 }] } },
        y: 5
      })
    ).toEqual({})
    expect(normalizeNotes(data)).toEqual(data)
    const tagged = addNotes({}, b, [
      note('1', { note: '<note>Old note</note>' })
    ])
    expect(normalizeNotes(tagged)['example.com'][b.url].notes[0].note).toBe(
      'Old note'
    )
  })

  it('exports Markdown with title, URL, quotes and notes', () => {
    const data = addNotes({}, b, [note('1', { quote: 'Q' })])
    const markdown = pageToMarkdown(data['example.com'][b.url])
    expect(markdown).toContain('# Guide')
    expect(markdown).toContain('https://example.com/b')
    expect(markdown).toContain('> Q')
    expect(markdown).toContain('Note 1')
  })
})

describe('findTextRange', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds a quote across elements and uses the text around it', () => {
    document.body.innerHTML =
      '<p>The cat sat.</p><p>Later the <b>cat</b> sat down again.</p>'
    const range = findTextRange(document, 'cat sat', 'Later the ', ' down')!
    expect(range.toString()).toBe('cat sat')
    expect(range.startContainer.parentElement?.tagName).toBe('B')
    expect(findTextRange(document, 'missing words')).toBeNull()
  })

  it('reads the text before and after a range', () => {
    document.body.innerHTML = '<p>alpha beta gamma</p>'
    const range = findTextRange(document, 'beta')!
    expect(textAround(range, 6)).toEqual({ before: 'alpha ', after: ' gamma' })
  })
})

describe('NotesService', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.getSelection()?.removeAllRanges()
  })

  async function setup(
    reply: string | ((input: unknown) => string) = 'A short note.'
  ) {
    const fake = fakeAi({ reply: reply as string })
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        storage: memoryStorageAdapter()
      })
    })
    const session = TestBed.inject(ChatSessionStore)
    const notes = TestBed.inject(NotesService)
    TestBed.tick()
    await flush()
    return { session, notes, fake }
  }

  it('saves the selected text with an AI note', async () => {
    document.body.innerHTML =
      '<p id="p">Before text. The important sentence. After text.</p>'
    const { notes, fake } = await setup()
    const range = findTextRange(document, 'The important sentence.')!
    document.getSelection()!.addRange(range)
    await notes.saveSelection()
    const page = notes.currentPage()!
    expect(page.notes[0].quote).toBe('The important sentence.')
    expect(page.notes[0].note).toBe('A short note.')
    expect(page.notes[0].before).toContain('Before text.')
    expect(promptText(fake.inputs[0])).toContain(
      'QUOTE:\nThe important sentence.'
    )
  })

  it('keeps the quote when the model fails', async () => {
    document.body.innerHTML = '<p>Some quote here.</p>'
    const fake = fakeAi({ error: new Error('down') })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const notes = TestBed.inject(NotesService)
    TestBed.tick()
    await flush()
    document.getSelection()!.addRange(findTextRange(document, 'Some quote')!)
    await notes.saveSelection()
    expect(notes.currentPage()!.notes[0]).toEqual(
      expect.objectContaining({ quote: 'Some quote', note: '' })
    )
  })

  it('makes notes for the whole page from the composer, in parts', async () => {
    document.title = 'Long page'
    document.body.innerHTML = `<p>${'word '.repeat(5000)}</p>`
    const { session, notes, fake } = await setup(
      '{"notes":["One.","Two.","Three."]}'
    )
    session.selectTool('notes')
    session.prompt.set('pricing')
    await session.send()
    expect(fake.inputs.length).toBe(3)
    expect(promptText(fake.inputs[0])).toContain('FOCUS ONLY ON: pricing')
    expect(notes.currentPage()!.notes.length).toBe(8)
    const answer = session.messages()[1]
    expect(answer.content).toContain('8 note(s) saved')
    expect(answer.card?.kind).toBe('notes')
  })

  it('reads notes lists from model answers', () => {
    expect(parseNotes('```json\n{"notes":["a"," ",3,"b"]}\n```')).toEqual([
      'a',
      'b'
    ])
    expect(parseNotes('no json')).toEqual([])
    expect(parseNotes('{"notes":["<note>Tagged.</note>"]}')).toEqual([
      'Tagged.'
    ])
  })

  it('opens a page in the panel and goes up level by level', async () => {
    const { notes } = await setup()
    notes.openPage('https://example.com/a#x')
    expect(TestBed.inject(PanelStore).panel()).toBe('notes')
    expect(notes.view()).toEqual({
      level: 'notes',
      host: 'example.com',
      url: 'https://example.com/a'
    })
    expect(notes.goUp()).toBe(true)
    expect(notes.view()).toEqual({ level: 'pages', host: 'example.com' })
    expect(notes.goUp()).toBe(true)
    expect(notes.goUp()).toBe(false)
  })
})

describe('NotesPanelComponent', () => {
  it('shows websites, then pages by title, then notes with the full URL', async () => {
    const storage = memoryStorageAdapter()
    let data = addNotes(
      {},
      { url: 'https://example.com/a', title: 'Same title' },
      [note('1', { quote: 'Quoted' })]
    )
    data = addNotes(
      data,
      { url: 'https://example.com/b', title: 'Same title' },
      [note('2')]
    )
    await storage.set('browse-ai-core', { notes: data })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fakeAi().provider, storage })
    })
    const fixture = TestBed.createComponent(NotesPanelComponent)
    await flush()
    await TestBed.inject(NotesService).refresh()
    fixture.detectChanges()
    const root = fixture.nativeElement as HTMLElement
    const buttons = () => [...root.querySelectorAll('button')]

    expect(root.textContent).toContain('example.com')
    expect(root.textContent).toContain('2 page(s)')
    buttons()
      .find((b) => b.textContent?.includes('example.com'))!
      .click()
    fixture.detectChanges()
    expect(root.textContent).toContain('Notes')
    expect(root.textContent).toContain('/a')
    expect(root.textContent).toContain('/b')

    buttons()
      .find((b) => b.textContent?.includes('/a'))!
      .click()
    fixture.detectChanges()
    const link = root.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://example.com/a')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(root.querySelector('blockquote')?.textContent).toContain('Quoted')
  })

  it('shows the green help box when there are no notes', async () => {
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fakeAi().provider })
    })
    const fixture = TestBed.createComponent(NotesPanelComponent)
    await flush()
    fixture.detectChanges()
    const root = fixture.nativeElement as HTMLElement
    expect(root.querySelector('[role="note"]')?.textContent).toContain(
      'How to use Notes'
    )
  })
})
