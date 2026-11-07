import { TestBed } from '@angular/core/testing'
import { AiPromptInput, memoryStorageAdapter } from 'browse-ai-core'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import {
  MAX_RESEARCH_PAGES,
  ResearchPage,
  addResearchPage,
  normalizeResearch,
  removeResearchPage,
  topicToMarkdown
} from '../../core/research-data'
import {
  ResearchService,
  keepValidCitations,
  parsePoints
} from './research.service'

const page = (url: string, points = ['Point']): ResearchPage => ({
  url,
  title: url,
  addedAt: '2026-11-07',
  points
})

describe('research data', () => {
  const data = {
    t: { id: 't', name: 'Topic', updatedAt: '', pages: [] as ResearchPage[] }
  }

  it('adds, replaces, limits and removes pages', () => {
    let next = addResearchPage(data, 't', page('a'))
    expect(next.result).toBe('added')
    next = addResearchPage(next.data, 't', page('a', ['New']))
    expect(next.result).toBe('updated')
    expect(next.data['t'].pages[0].points).toEqual(['New'])
    const full = {
      t: {
        ...data.t,
        pages: Array.from({ length: MAX_RESEARCH_PAGES }, (_, i) =>
          page(`p${i}`)
        )
      }
    }
    expect(addResearchPage(full, 't', page('new')).result).toBe('full')
    expect(removeResearchPage(next.data, 't', 'a')['t'].pages).toEqual([])
  })

  it('normalizes stored topics and exports Markdown', () => {
    expect(
      normalizeResearch({
        t: {
          name: 'X',
          pages: [{ url: 'u', points: ['p', 3] }, { bad: true }]
        },
        z: 1
      })
    ).toEqual({
      t: {
        id: 't',
        name: 'X',
        updatedAt: '',
        pages: [{ url: 'u', title: '', addedAt: '', points: ['p'] }]
      }
    })
    const markdown = topicToMarkdown({
      ...data.t,
      pages: [page('https://a.test')]
    })
    expect(markdown).toContain('# Topic')
    expect(markdown).toContain('- Point')
  })

  it('removes wrapper tags from key points', () => {
    expect(
      parsePoints('{"points":["<point>Solar is cheap.</point>"]}')
    ).toEqual(['Solar is cheap.'])
  })

  it('keeps only citations that match a source', () => {
    expect(keepValidCitations('A [1]. B [9]. C [2].', new Set([1, 2]))).toEqual(
      { text: 'A [1]. B. C [2].', used: [1, 2] }
    )
  })
})

describe('Research Notes tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function setup(reply: (input: AiPromptInput) => string) {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        storage: memoryStorageAdapter()
      })
    })
    const session = TestBed.inject(ChatSessionStore)
    const research = TestBed.inject(ResearchService)
    TestBed.tick()
    await flush()
    return { session, research, fake }
  }

  async function send(session: ChatSessionStore, text: string) {
    session.selectTool('research-notes')
    session.prompt.set(text)
    await session.send()
    return session.messages().at(-1)!
  }

  it('asks for a topic first', async () => {
    const { session } = await setup(() => '')
    expect((await send(session, '')).content).toBe(
      'Pick or create a topic first.'
    )
  })

  it('adds the page, then answers with sources', async () => {
    document.title = 'Solar panels'
    document.body.innerHTML = `<p>${'Solar panels make power from light. '.repeat(30)}</p>`
    const { session, research, fake } = await setup((input) =>
      promptText(input).includes('key points')
        ? '{"points":["Panels turn light into power."]}'
        : 'They use light [1]. Also [4].'
    )
    await research.createTopic('Energy')
    const added = await send(session, '')
    expect(added.content).toContain(
      'Page added to Energy. 1 page(s) in Energy.'
    )
    expect(added.content).toContain('- Panels turn light into power.')

    const again = await send(session, '')
    expect(again.content).toContain('Page updated in Energy')

    const answer = await send(session, 'How do panels work?')
    expect(promptText(fake.inputs.at(-1)!)).toContain('[1] Solar panels')
    expect(answer.content).toBe('They use light [1]. Also.')
    expect(answer.card).toEqual({
      kind: 'research',
      sources: [{ n: 1, title: 'Solar panels', url: document.location.href }]
    })
  })

  it('says when the topic is empty and lists pages', async () => {
    const { session, research } = await setup(() => '')
    await research.createTopic('Empty')
    expect((await send(session, 'question')).content).toContain(
      'This topic has no pages yet.'
    )
    expect((await send(session, 'list')).card?.kind).toBe('research-pages')
  })

  it('remembers the last topic', async () => {
    const storage = memoryStorageAdapter()
    await storage.set('browse-ai-core', {
      research: { t1: { name: 'Saved', pages: [] } },
      preferences: { researchTopic: 't1' }
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fakeAi().provider, storage })
    })
    const research = TestBed.inject(ResearchService)
    await research.refresh()
    expect(research.topic()?.name).toBe('Saved')
  })
})
