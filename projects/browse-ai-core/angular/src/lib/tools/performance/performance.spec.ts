import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { PerfCardComponent } from '../../components/tool-card/perf-card.component'
import { PanelStore } from '../../core/panel.store'
import { chartMax, chartStats, linePath } from '../../ui/charts/chart-paths'
import {
  RingBuffer,
  clsFromShifts,
  formatMetric,
  inpFromInteractions,
  rate,
  shortUrl,
  tbtFromLongTasks
} from './metrics'
import { PerformanceCollectorService } from './performance-collector.service'
import { SUMMARY_MAX, summaryJson } from './performance-explainer.service'

describe('performance metrics', () => {
  it('rates values with Google limits', () => {
    expect(rate('lcp', 2000)).toBe('good')
    expect(rate('lcp', 3000)).toBe('needs-work')
    expect(rate('lcp', 5000)).toBe('poor')
    expect(rate('cls', 0.3)).toBe('poor')
    expect(formatMetric('lcp', 2500)).toBe('2.50 s')
    expect(formatMetric('inp', 120)).toBe('120 ms')
    expect(formatMetric('cls', 0.05)).toBe('0.050')
  })

  it('computes CLS from the largest session window', () => {
    const shifts = [
      { startTime: 0, value: 0.05 },
      { startTime: 500, value: 0.05 },
      { startTime: 3000, value: 0.2 },
      { startTime: 3500, value: 0.01 }
    ]
    expect(clsFromShifts(shifts)).toBeCloseTo(0.21)
    expect(clsFromShifts([])).toBe(0)
  })

  it('computes INP, skipping one interaction per 50', () => {
    expect(inpFromInteractions([])).toBeNull()
    expect(inpFromInteractions([40, 300, 80])).toBe(300)
    const many = [...Array.from({ length: 99 }, () => 50), 900]
    expect(inpFromInteractions(many)).toBe(50)
  })

  it('computes TBT after FCP and keeps a fixed-size buffer', () => {
    expect(
      tbtFromLongTasks(
        [
          { startTime: 10, duration: 120 },
          { startTime: 500, duration: 80 },
          { startTime: 600, duration: 40 }
        ],
        100
      )
    ).toBe(30)
    const buffer = new RingBuffer(3)
    ;[1, 2, 3, 4].forEach((value) => buffer.push(value))
    expect(buffer.toArray()).toEqual([2, 3, 4])
    expect(shortUrl('https://a.test/x.js?v=1#y')).toBe('https://a.test/x.js')
  })
})

describe('chart paths', () => {
  it('draws lines from the right edge and breaks at gaps', () => {
    expect(linePath([0, 10], 100, 10, 10, 2)).toBe('M0.0 10.0 L100.0 0.0')
    expect(linePath([5, Number.NaN, 5], 200, 10, 10, 3)).toBe(
      'M0.0 5.0 M200.0 5.0'
    )
    expect(linePath([10], 100, 10, 10, 2)).toBe('M100.0 0.0')
    expect(chartMax([Number.NaN, 0])).toBe(1)
    expect(chartStats([1, Number.NaN, 5, 3])).toEqual({
      last: 3,
      min: 1,
      max: 5
    })
  })
})

describe('PerformanceCollectorService', () => {
  it('samples once per call and adds gaps for missed seconds', () => {
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fakeAi().provider })
    })
    const collector = TestBed.inject(PerformanceCollectorService)
    collector.sample(Date.now() + 1000)
    collector.sample(Date.now() + 4000)
    const busy = collector.series().busy
    expect(busy.length).toBe(4)
    expect(busy.filter(Number.isNaN).length).toBe(2)
    collector.paused.set(true)
    collector.sample(Date.now() + 5000)
    expect(collector.series().busy.length).toBe(4)
    collector.reset()
    expect(collector.series().busy).toEqual([])
  })
})

describe('Performance Explainer tool', () => {
  it('keeps the summary under the size limit', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      url: `https://cdn.test/${'x'.repeat(300)}${i}.js`,
      type: 'script',
      kb: 10,
      ms: 5
    }))
    const json = summaryJson({
      metrics: {},
      lcpElement: '',
      longTasks: { count: 0, totalMs: 0 },
      largestFiles: files,
      slowestFiles: files
    })
    expect(json.length).toBeLessThanOrEqual(SUMMARY_MAX)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('explains the data and shows a live card with tiles and charts', async () => {
    const fake = fakeAi({ reply: 'Your page is fine.' })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.inject(PanelStore).open('chat')
    TestBed.tick()
    await flush()
    session.selectTool('performance-explainer')
    session.prompt.set('why is it slow?')
    await session.send()
    expect(promptText(fake.inputs[0])).toContain(
      "Answer the user's question using this data: why is it slow?"
    )
    expect(promptText(fake.inputs[0])).toContain('DATA: {')
    expect(session.messages()[1].card).toEqual({ kind: 'performance' })

    const fixture = TestBed.createComponent(PerfCardComponent)
    fixture.componentRef.setInput('live', true)
    fixture.detectChanges()
    const root = fixture.nativeElement as HTMLElement
    expect(root.textContent).toContain('LCP')
    expect(root.textContent).toContain('Interact with the page to measure')
    expect(root.querySelectorAll('svg[role="img"]').length).toBeGreaterThan(0)
    expect(root.querySelector('svg')?.getAttribute('aria-label')).toContain(
      'now'
    )
    ;[...root.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Show as table'))!
      .click()
    fixture.detectChanges()
    expect(root.querySelector('table')).not.toBeNull()
  })
})
