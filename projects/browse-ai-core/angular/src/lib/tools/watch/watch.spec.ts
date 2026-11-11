import { TestBed } from '@angular/core/testing'
import { AiPromptInput } from 'browse-ai-core'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import type { ToolRequest } from '../../chat/tool-runner'
import { ToolNotices } from '../../chat/tool-notices'
import { ChatEvents } from '../../chat/chat-events'
import { createLocator, findByLocator, isStableClass } from './element-locator'
import { buildWatchPrompt, parseWatchVerdict } from './watch-prompt'
import { WatchRunnerService } from './watch-runner.service'
import { diffLines, extractNumbers, readWatchedText } from './watched-text'

function request(text: string): ToolRequest {
  return {
    text,
    selection: null,
    framework: 'angular',
    signal: new AbortController().signal,
    onChunk: () => undefined,
    onStatus: () => undefined
  }
}

describe('watched text', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('reads text and field values but not passwords', () => {
    document.body.innerHTML =
      '<div id="w">Price <input value="12" /><input type="password" value="secret" /><select><option>A</option><option selected>B</option></select></div>'
    const text = readWatchedText(document.getElementById('w')!)
    expect(text).toContain('Price')
    expect(text).toContain('12')
    expect(text).toContain('B')
    expect(text).not.toContain('secret')
  })

  it('finds numbers with English and German separators', () => {
    expect(extractNumbers('Now $1,234.50 (up 3%)', 'en')).toEqual([1234.5, 3])
    expect(extractNumbers('Jetzt 1.234,50 €', 'de')).toEqual([1234.5])
  })

  it('lists removed and added lines', () => {
    expect(
      diffLines('Status: Packed. Price 10.', 'Status: Shipped. Price 10.')
    ).toBe('- Status: Packed.\n+ Status: Shipped.')
  })
})

describe('element locator', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds a re-rendered element by its path', () => {
    document.body.innerHTML =
      '<main id="app"><div><span class="price">10</span></div></main>'
    const locator = createLocator(document.querySelector('.price')!)
    document.getElementById('app')!.innerHTML =
      '<div><span class="price">11</span></div>'
    expect(findByLocator(document, locator)?.textContent).toBe('11')
  })

  it('skips hashed class names', () => {
    expect(isStableClass('price')).toBe(true)
    expect(isStableClass('css-1x2y3z')).toBe(false)
    expect(isStableClass('sc-a1b2c3')).toBe(false)
    expect(isStableClass('Price_value__3kd8f')).toBe(false)
  })
})

describe('watch prompt', () => {
  it('includes both texts and numbers', () => {
    const prompt = buildWatchPrompt({
      instruction: 'below 100',
      baseline: 'Price 105',
      previous: 'Price 101',
      current: 'Price 99'
    })
    expect(prompt).toContain('NUMBERS AT THE LAST CHECK: 101')
    expect(prompt).toContain('NUMBERS NOW: 99')
    expect(prompt).toContain('TEXT WHEN WATCHING STARTED: Price 105')
  })

  it('reads verdicts, including percent confidence', () => {
    expect(
      parseWatchVerdict('{"matches":true,"confidence":80,"message":"Down"}')
    ).toEqual({ matches: true, confidence: 0.8, message: 'Down' })
    expect(parseWatchVerdict('nope')).toBeNull()
  })
})

describe('WatchRunnerService', () => {
  let replies: string[]
  let inputs: AiPromptInput[]
  let current: WatchRunnerService | null = null

  function setup() {
    const fake = fakeAi({
      reply: () =>
        replies.shift() ?? '{"matches":false,"confidence":0,"message":""}'
    })
    inputs = fake.inputs
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        features: { watchMode: true }
      })
    })
    const watch = TestBed.inject(WatchRunnerService)
    current = watch
    const notices: string[] = []
    TestBed.inject(ToolNotices).posted.subscribe((notice) =>
      notices.push(notice.text)
    )
    const matched: string[] = []
    TestBed.inject(ChatEvents).watchMatched.subscribe((event) =>
      matched.push(event.current)
    )
    return { watch, notices, matched }
  }

  beforeEach(() => {
    replies = []
    document.body.innerHTML =
      '<main id="app"><span id="price">Price 105</span></main>'
  })
  afterEach(() => {
    current?.stop(false)
    document.body.innerHTML = ''
  })

  async function start(watch: WatchRunnerService) {
    ;(watch as unknown as { picked: { set: (v: unknown) => void } }).picked.set(
      {
        element: document.getElementById('price'),
        label: 'span#price',
        preview: 'Price 105',
        tooLong: false
      }
    )
    return watch.run(request('Tell me when the price is below 100'))
  }

  it('does not call the model when the text is unchanged', async () => {
    const { watch } = setup()
    const result = await start(watch)
    expect(result.content).toContain('Watching span#price')
    await watch.check()
    await watch.check()
    expect(inputs.length).toBe(0)
    expect(watch.status()?.checks).toBe(2)
  })

  it('reports a match once and keeps watching', async () => {
    const { watch, notices, matched } = setup()
    await start(watch)
    document.getElementById('price')!.textContent = 'Price 99'
    replies.push(
      '{"matches":true,"confidence":0.9,"message":"The price is 99."}'
    )
    await watch.check()
    expect(promptText(inputs[0])).toContain('TEXT NOW: Price 99')
    expect(notices.some((text) => text.includes('The price is 99.'))).toBe(true)
    expect(matched).toEqual(['Price 99'])
    expect(watch.status()?.matches).toBe(1)
    expect(watch.status()).not.toBeNull()
  })

  it('ignores matches under the threshold', async () => {
    const { watch, matched } = setup()
    await start(watch)
    document.getElementById('price')!.textContent = 'Price 101'
    replies.push('{"matches":true,"confidence":0.5,"message":"maybe"}')
    await watch.check()
    expect(matched).toEqual([])
  })

  it('finds the element again after a re-render', async () => {
    const { watch, matched } = setup()
    await start(watch)
    document.getElementById('app')!.innerHTML =
      '<span id="price">Price 98</span>'
    replies.push('{"matches":true,"confidence":1,"message":"98"}')
    await watch.check()
    expect(matched).toEqual(['Price 98'])
  })

  it('says when checks keep failing, then goes on', async () => {
    const { watch, notices } = setup()
    await start(watch)
    for (let i = 0; i < 3; i++) {
      document.getElementById('price')!.textContent = `Price ${90 + i}`
      replies.push('broken')
      await watch.check()
    }
    expect(notices.some((text) => text.startsWith('Checks are failing'))).toBe(
      true
    )
    expect(watch.status()).not.toBeNull()
  })

  it('posts a summary on Stop', async () => {
    const { watch, notices } = setup()
    await start(watch)
    await watch.check()
    watch.stop()
    await flush()
    expect(watch.status()).toBeNull()
    expect(notices.at(-1)).toContain('Stopped watching. 1 check(s)')
  })
})
