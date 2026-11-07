import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core'
import { formatString } from 'browse-ai-core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { PanelStore } from '../../core/panel.store'
import {
  METRIC_IDS,
  METRIC_NAMES,
  MetricId,
  Rating,
  formatMetric,
  rate
} from '../../tools/performance/metrics'
import {
  PerformanceCollectorService,
  PerformanceSeries,
  ResourceInfo,
  WINDOW_SECONDS
} from '../../tools/performance/performance-collector.service'
import { PerformanceExplainerService } from '../../tools/performance/performance-explainer.service'
import { ButtonComponent } from '../../ui/button/button.component'
import { chartStats } from '../../ui/charts/chart-paths'
import {
  ChartSeries,
  LineChartComponent
} from '../../ui/charts/line-chart.component'

interface Snapshot {
  metrics: Record<MetricId, number | null>
  series: PerformanceSeries
  files: ResourceInfo[]
}

/** Metric tiles and live charts. Updates once per second while visible. */
@Component({
  selector: 'bac-perf-card',
  imports: [ButtonComponent, LineChartComponent],
  templateUrl: './perf-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: '@container block' }
})
export class PerfCardComponent {
  readonly live = input(false)
  readonly collector = inject(PerformanceCollectorService)
  readonly explainer = inject(PerformanceExplainerService)
  readonly session = inject(ChatSessionStore)
  readonly #panel = inject(PanelStore)
  readonly t = this.session.strings
  readonly slots = WINDOW_SECONDS
  readonly asTable = signal(false)
  readonly visible = signal(true)

  readonly snapshot = signal<Snapshot>(this.#read())

  readonly tiles = computed(() => {
    const strings = this.t()
    const labels: Record<Rating, string> = {
      good: strings.ratingGood,
      'needs-work': strings.ratingNeedsWork,
      poor: strings.ratingPoor
    }
    return METRIC_IDS.map((id) => {
      const value = this.snapshot().metrics[id]
      const rating = value === null ? null : rate(id, value)
      return {
        id,
        name: METRIC_NAMES[id],
        value:
          value === null
            ? id === 'inp'
              ? strings.interactToMeasure
              : strings.notAvailable
            : formatMetric(id, value),
        rating,
        ratingLabel: rating ? labels[rating] : ''
      }
    })
  })

  readonly charts = computed(() => {
    const strings = this.t()
    const series = this.snapshot().series
    const charts: { title: string; series: ChartSeries[]; bars?: boolean }[] = [
      {
        title: `${strings.mainThreadBusy} / ${strings.interactionTime}`,
        series: [
          {
            label: strings.mainThreadBusy,
            values: series.busy,
            color: 'primary'
          },
          {
            label: strings.interactionTime,
            values: series.interaction,
            color: 'warning'
          }
        ]
      },
      {
        title: strings.layoutShifts,
        series: [
          {
            label: strings.layoutShifts,
            values: series.shifts,
            color: 'danger'
          }
        ],
        bars: true
      }
    ]
    if (series.heap.some((value) => value > 0)) {
      charts.push({
        title: strings.memoryUsed,
        series: [
          { label: strings.memoryUsed, values: series.heap, color: 'success' }
        ]
      })
    }
    return charts.map((chart) => ({
      ...chart,
      label: chart.series
        .map((line) =>
          formatString(strings.chartSummary, {
            name: line.label,
            ...chartStats(line.values)
          })
        )
        .join('. ')
    }))
  })

  readonly files = computed(() => {
    const files = this.snapshot().files.slice(0, 5)
    const max = Math.max(1, ...files.map((file) => file.sizeKb))
    return files.map((file) => ({
      ...file,
      name: fileName(file.url),
      percent: Math.round((file.sizeKb / max) * 100)
    }))
  })

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(([entry]) =>
        this.visible.set(entry.isIntersecting)
      )
      observer.observe(host)
      inject(DestroyRef).onDestroy(() => observer.disconnect())
    }
    effect(() => {
      this.collector.tick()
      const update =
        this.live() &&
        this.visible() &&
        this.#panel.isOpen() &&
        !this.collector.paused()
      if (update) untracked(() => this.snapshot.set(this.#read()))
    })
  }

  togglePause(): void {
    this.collector.paused.update((paused) => !paused)
  }

  reset(): void {
    this.collector.reset()
    this.snapshot.set(this.#read())
  }

  explainAgain(): void {
    void this.session.runTool('performance-explainer', '')
  }

  rows(values: number[]): { second: number; value: string }[] {
    return values
      .map((value, index) => ({
        second: index - values.length + 1,
        value: Number.isFinite(value) ? String(value) : '—'
      }))
      .reverse()
  }

  #read(): Snapshot {
    return {
      metrics: this.collector.metrics(),
      series: this.collector.series(),
      files: this.collector.largestResources()
    }
  }
}

function fileName(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname
  } catch {
    return url
  }
}
