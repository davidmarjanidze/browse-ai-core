import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ExtraToolRunner } from '../../chat/extra-tool-runner'
import {
  findHardCancel,
  findPrechecked,
  findScarcity,
  findShaming,
  findSneak,
  timerCandidates,
  timerSeconds
} from './dark-pattern-scanner'
import { parseConfirmed } from './dark-pattern-detector.service'

describe('dark pattern scanner', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds pre-checked extras but not unchecked or plain boxes', () => {
    document.body.innerHTML = `
      <label><input type="checkbox" checked> Send me the newsletter</label>
      <label><input type="checkbox"> Add travel insurance</label>
      <label><input type="checkbox" checked> I accept the terms</label>`
    expect(findPrechecked(document).map((f) => f.evidence)).toEqual([
      'Send me the newsletter'
    ])
  })

  it('finds timer, scarcity, shaming and sneak candidates', () => {
    document.body.innerHTML = `
      <div><p>Offer ends in <span id="t">09:59</span></p></div>
      <p>Only 2 left in stock</p>
      <button>No thanks, I don't like saving money</button>
      <button>No</button>
      <ul class="cart-items"><li>Phone $499.00</li><li>Protection plan added $29.99</li></ul>`
    expect(timerCandidates(document).map((el) => el.id)).toEqual(['t'])
    expect(timerSeconds('01:02:03')).toBe(3723)
    expect(findScarcity(document).length).toBe(1)
    expect(findShaming(document).map((f) => f.evidence)).toEqual([
      "No thanks, I don't like saving money"
    ])
    expect(findSneak(document).map((f) => f.evidence)).toEqual([
      'Protection plan added $29.99'
    ])
  })

  it('flags cancel pages with no cancel button only', () => {
    document.body.innerHTML =
      '<h1>Cancel your membership</h1><button>Keep my plan</button>'
    expect(findHardCancel(document).length).toBe(1)
    document.body.innerHTML =
      '<h1>Cancel your membership</h1><button>Cancel membership</button>'
    expect(findHardCancel(document)).toEqual([])
  })

  it('reads confirmed indexes', () => {
    expect(
      parseConfirmed('{"confirmed":[{"index":1},{"index":9}]}', 3)
    ).toEqual(new Set([1]))
  })
})

describe('Dark Pattern Detector tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function run(reply: string) {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('dark-pattern-detector')
    await session.send()
    return { session, fake, runner: TestBed.inject(ExtraToolRunner) }
  }

  it('sends only short candidates, drops unconfirmed ones, marks the page and unchecks', async () => {
    document.body.innerHTML = `
      <label><input id="box" type="checkbox" checked> Add donation to charity</label>
      <p>Only 3 left!</p>
      <button>No thanks, I hate good deals and want to pay more</button>`
    const { session, fake, runner } = await run(
      '{"confirmed":[{"index":1,"reason":"guilt"}]}'
    )
    const prompt = promptText(fake.inputs[0])
    expect(prompt).toContain('[0] (scarcity) Only 3 left!')
    expect(prompt).not.toContain('donation')
    const card = session.messages()[1].card as {
      kind: 'dark-patterns'
      findings: { type: string; canUncheck: boolean }[]
    }
    expect(card.findings.map((f) => f.type)).toEqual(['prechecked', 'shaming'])
    expect(card.findings[0].canUncheck).toBe(true)
    expect(runner.darkPatterns.markCount).toBe(2)

    runner.darkPatterns.uncheck(1)
    expect((document.getElementById('box') as HTMLInputElement).checked).toBe(
      false
    )
    expect(runner.darkPatterns.markCount).toBe(1)

    session.clear()
    expect(runner.darkPatterns.markCount).toBe(0)
  })

  it('says when nothing is found, without calling the model', async () => {
    document.body.innerHTML = '<p>Plain page</p>'
    const { session, fake } = await run('{}')
    expect(session.messages()[1].content).toBe(
      'No dark patterns were found on this page.'
    )
    expect(fake.inputs.length).toBe(0)
  })
})
