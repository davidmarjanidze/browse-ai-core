import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ArgumentMapComponent } from '../../components/tool-card/argument-map.component'
import { ArgumentMap } from '../../chat/tool-card.model'
import { argumentToMarkdown, parseArgumentMap } from './argument-mapper.service'

const ANSWER = JSON.stringify({
  claim: 'Cities should add bike lanes',
  points: [
    {
      type: 'support',
      text: 'Fewer cars',
      evidence: 'data',
      quote: 'traffic fell 20%',
      points: [
        {
          type: 'support',
          text: 'Less noise',
          evidence: 'none',
          quote: '',
          points: [{ text: 'too deep' }]
        }
      ]
    },
    {
      type: 'counter',
      text: 'Costs money',
      evidence: 'weird',
      quote: 'cost a lot'
    },
    { type: 'support', text: '' }
  ]
})

describe('parseArgumentMap', () => {
  it('reads the claim, points and one level of sub-points', () => {
    const map = parseArgumentMap(ANSWER)!
    expect(map.claim).toBe('Cities should add bike lanes')
    expect(
      map.points.map((point) => [point.type, point.text, point.evidence])
    ).toEqual([
      ['support', 'Fewer cars', 'data'],
      ['counter', 'Costs money', 'none']
    ])
    expect(map.points[0].points.map((point) => point.text)).toEqual([
      'Less noise'
    ])
    expect(map.points[0].points[0].points).toEqual([])
  })

  it('returns null without a claim and keeps at most 6 per side', () => {
    expect(parseArgumentMap('{"points":[]}')).toBeNull()
    expect(parseArgumentMap('broken')).toBeNull()
    const many = {
      claim: 'c',
      points: Array.from({ length: 9 }, (_, i) => ({
        type: 'support',
        text: `p${i}`
      }))
    }
    expect(parseArgumentMap(JSON.stringify(many))!.points.length).toBe(6)
  })

  it('writes a nested Markdown list', () => {
    const markdown = argumentToMarkdown(parseArgumentMap(ANSWER)!, {
      claim: 'Main claim',
      support: 'For',
      counter: 'Against'
    })
    expect(markdown).toContain('**Main claim:** Cities should add bike lanes')
    expect(markdown).toContain('- Fewer cars (data)')
    expect(markdown).toContain('  - Less noise (none)')
    expect(markdown).toContain('**Against**')
  })
})

describe('Argument Mapper tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('maps the page text and shows the claim', async () => {
    document.body.innerHTML =
      '<p>Bike lanes are good. Last year traffic fell 20% downtown. Some say they cost a lot.</p>'
    const fake = fakeAi({ reply: ANSWER })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('argument-mapper')
    await session.send()
    expect(promptText(fake.inputs[0])).toContain('traffic fell 20%')
    const answer = session.messages()[1]
    expect(answer.content).toBe('**Main claim:** Cities should add bike lanes')
    expect(answer.card?.kind).toBe('argument')

    const fixture = TestBed.createComponent(ArgumentMapComponent)
    fixture.componentRef.setInput(
      'map',
      (answer.card as { map: ArgumentMap }).map
    )
    fixture.detectChanges()
    const root = fixture.nativeElement as HTMLElement
    expect((fixture.nativeElement as HTMLElement).className).toContain(
      '@container'
    )
    const grid = root.querySelector('.grid')!
    expect(grid.className).toContain('@xl:grid-cols-2')
    fixture.componentRef.setInput('map', {
      claim: 'c',
      points: [
        {
          type: 'support',
          text: 'Only for',
          evidence: 'none',
          quote: '',
          points: []
        }
      ]
    })
    fixture.detectChanges()
    expect(grid.className).not.toContain('grid-cols-2')
    fixture.componentRef.setInput(
      'map',
      (answer.card as { map: ArgumentMap }).map
    )
    fixture.detectChanges()
    expect(root.textContent).toContain('Points for')
    expect(root.textContent).toContain('Points against')
    expect(
      [...root.querySelectorAll('button')].filter((b) =>
        b.textContent?.includes('Show on page')
      ).length
    ).toBe(2)
  })

  it('says when there is no argument', async () => {
    document.body.innerHTML = '<p>Text</p>'
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fakeAi({ reply: '{}' }).provider
      })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('argument-mapper')
    await session.send()
    expect(session.messages()[1].content).toBe(
      'No clear argument was found in this text.'
    )
  })
})
