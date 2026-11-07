import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ExtraToolRunner } from '../../chat/extra-tool-runner'
import { buildLinkPrompt, parseLinkMatches } from './link-inspector.service'
import { classifyLink, scanLinks } from './link-scanner'

describe('scanLinks', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('groups links, merges repeats and skips the chat and hidden links', () => {
    document.body.innerHTML = `
      <a href="/pricing">Pricing</a>
      <a href="/pricing">See pricing</a>
      <a href="https://other.example.org/x">Partner</a>
      <a href="/files/report.pdf">Report</a>
      <a href="mailto:hi@example.com">Mail us</a>
      <a href="javascript:void(0)">Click</a>
      <a href="https://evil.test/login">paypal.com</a>
      <a href="/hidden" style="display:none">Hidden</a>
      <div id="chat"><a href="/inside">Inside chat</a></div>`
    const { rows, elements } = scanLinks(
      document,
      document.getElementById('chat')
    )
    const byText = Object.fromEntries(rows.map((row) => [row.text, row]))
    expect(byText['Pricing'].group).toBe('internal')
    expect(byText['Pricing'].count).toBe(2)
    expect(elements.get(byText['Pricing'].id)?.length).toBe(2)
    expect(byText['Partner'].group).toBe('external')
    expect(byText['Report'].group).toBe('download')
    expect(byText['Mail us'].group).toBe('contact')
    expect(byText['Click'].group).toBe('suspicious')
    expect(byText['paypal.com'].group).toBe('suspicious')
    expect(byText['Hidden']).toBeUndefined()
    expect(byText['Inside chat']).toBeUndefined()
  })

  it('treats empty and # hrefs as suspicious and download attributes as downloads', () => {
    const url = new URL('https://site.test/a')
    expect(classifyLink('#', url, 'Top', 'site.test', false)).toBe('suspicious')
    expect(classifyLink('', null, 'x', 'site.test', false)).toBe('suspicious')
    expect(classifyLink('/a', url, 'Get', 'site.test', true)).toBe('download')
    expect(classifyLink('/a', url, 'site.test', 'www.site.test', false)).toBe(
      'internal'
    )
  })
})

describe('link answers', () => {
  const rows = [
    {
      id: 0,
      url: 'https://site.test/pricing',
      text: 'Pricing',
      group: 'internal' as const,
      count: 1
    },
    {
      id: 1,
      url: 'https://site.test/docs',
      text: 'Docs',
      group: 'internal' as const,
      count: 1
    }
  ]

  it('keeps known indexes in order and drops unknown and repeated ones', () => {
    const matches = parseLinkMatches(
      '{"matches":[{"index":1,"reason":"docs"},{"index":7},{"index":1},{"index":0}]}',
      rows
    )
    expect(matches.map((row) => row.id)).toEqual([1, 0])
    expect(matches[0].reason).toBe('docs')
    expect(parseLinkMatches('nonsense', rows)).toEqual([])
  })

  it('writes internal links as paths', () => {
    const prompt = buildLinkPrompt('pricing', rows, 'site.test')
    expect(prompt).toContain('[0] Pricing | /pricing')
  })
})

describe('Link Inspector tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function run(text: string, reply = '{"matches":[]}') {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('link-inspector')
    session.prompt.set(text)
    await session.send()
    return { session, fake }
  }

  it('lists all links without calling the model when there is no text', async () => {
    document.body.innerHTML = '<a href="/a">A</a><a href="https://x.test">X</a>'
    const { session, fake } = await run('')
    const answer = session.messages()[1]
    expect(answer.content).toBe('2 link(s) on this page.')
    expect(answer.card?.kind).toBe('links')
    expect(fake.inputs.length).toBe(0)
  })

  it('answers with matched links and can scroll to one', async () => {
    document.body.innerHTML =
      '<a href="/a">Home</a><a href="/pricing">Pricing</a>'
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this)
    }
    const { session, fake } = await run(
      'pricing page',
      '{"matches":[{"index":1,"reason":"named Pricing"}]}'
    )
    expect(promptText(fake.inputs[0])).toContain('USER WANTS: pricing page')
    const card = session.messages()[1].card
    expect(card?.kind === 'links' && card.matched && card.links[0].text).toBe(
      'Pricing'
    )
    expect(TestBed.inject(ExtraToolRunner).links.reveal(1)).toBe(true)
    expect(scrolled[0].textContent).toBe('Pricing')
  })

  it('shows all links when nothing matches', async () => {
    document.body.innerHTML = '<a href="/a">Home</a>'
    const { session } = await run('careers')
    expect(session.messages()[1].content).toContain('No link matches')
    const card = session.messages()[1].card
    expect(card?.kind === 'links' && card.matched).toBe(false)
  })

  it('answers with noLinks on a page without links', async () => {
    document.body.innerHTML = '<p>No links</p>'
    const { session } = await run('')
    expect(session.messages()[1].content).toBe(
      'No links were found on this page.'
    )
  })
})
