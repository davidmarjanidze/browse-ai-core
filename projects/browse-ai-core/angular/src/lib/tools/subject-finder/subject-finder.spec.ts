import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { PanelStore } from '../../core/panel.store'
import { MAX_CANDIDATES, pickCandidates, words } from './rank-blocks'
import { parseFinderAnswer } from './subject-finder.service'
import { TextBlock, collectTextBlocks } from './text-blocks'

describe('collectTextBlocks', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('splits the page into text blocks and skips the chat and scripts', () => {
    document.body.innerHTML = `
      <h2>Rules</h2>
      <p>Be kind to other people here.</p>
      <ul><li>No spam or ads please.</li><li>ok</li></ul>
      <script>var hidden = "script text here"</script>
      <div id="chat"><p>Text inside the chat itself</p></div>`
    const host = document.getElementById('chat')!
    const blocks = collectTextBlocks(document, host)
    expect(blocks.map((block) => block.text)).toEqual([
      'Rules',
      'Be kind to other people here.',
      'No spam or ads please.'
    ])
    expect(blocks[0].isHeading).toBe(true)
  })
})

describe('pickCandidates', () => {
  const block = (text: string): TextBlock => ({
    element: document.createElement('p'),
    text,
    isHeading: false
  })

  it('sends small pages whole', () => {
    const blocks = [block('one two three'), block('four five six')]
    expect(pickCandidates('rules', blocks)).toEqual(blocks)
  })

  it('ranks big pages by shared words and keeps page order', () => {
    const filler = Array.from({ length: 100 }, (_, i) =>
      block(`${'lorem ipsum dolor '.repeat(5)} ${i}`)
    )
    const rules = block('These are the platform rules for members')
    const blocks = [...filler.slice(0, 50), rules, ...filler.slice(50)]
    const picked = pickCandidates("I'm looking for the platform rules", blocks)
    expect(picked).toEqual([rules])
    expect(picked.length).toBeLessThanOrEqual(MAX_CANDIDATES)
    expect(words('The Rules')).toEqual(['rule'])
  })

  it('accepts only valid indexes from the model', () => {
    expect(parseFinderAnswer('{"index": 2}', 3)).toBe(2)
    expect(parseFinderAnswer('{"index": 3}', 3)).toBeNull()
    expect(parseFinderAnswer('{"index": null}', 3)).toBeNull()
    expect(parseFinderAnswer('nothing', 3)).toBeNull()
  })
})

describe('Subject Finder tool', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  async function run(reply: string, width = 1200) {
    vi.stubGlobal('innerWidth', width)
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    const panel = TestBed.inject(PanelStore)
    TestBed.tick()
    await flush()
    panel.open('chat')
    session.selectTool('subject-finder')
    session.prompt.set('the platform rules')
    await session.send()
    return { session, fake, panel }
  }

  it('scrolls to the picked block and answers with the fixed text', async () => {
    document.body.innerHTML = `
      <p id="a">Welcome to our nice site.</p>
      <details><summary>More</summary><p id="b">Platform rules: be kind.</p></details>`
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this)
    }
    const { session, fake, panel } = await run('{"index": 1}')
    expect(promptText(fake.inputs[0])).toContain('[1] Platform rules: be kind.')
    expect(scrolled.map((el) => el.id)).toEqual(['b'])
    expect(document.querySelector('details')!.open).toBe(true)
    expect(session.messages()[1].content).toBe(
      'I scrolled to what you were looking for.'
    )
    expect(panel.isOpen()).toBe(true)
  })

  it('closes the panel on small screens after scrolling', async () => {
    document.body.innerHTML = '<p>Platform rules: be kind.</p>'
    Element.prototype.scrollIntoView = () => undefined
    const { panel } = await run('{"index": 0}', 400)
    expect(panel.isOpen()).toBe(false)
  })

  it('says it could not find it when the model picks nothing', async () => {
    document.body.innerHTML = '<p>Welcome to our nice site.</p>'
    const { session } = await run('{"index": null}')
    expect(session.messages()[1].content).toBe(
      "I couldn't find what you were looking for."
    )
  })
})
