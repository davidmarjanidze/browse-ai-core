import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core'
import { chartMax, linePath } from './chart-paths'

export interface ChartSeries {
  label: string
  values: number[]
  /** A `--bac-*` color token name, without the prefix. */
  color: string
}

const WIDTH = 300

/** Line chart for a rolling window. Draws with SVG and theme colors. */
@Component({
  selector: 'bac-line-chart',
  templateUrl: './line-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class LineChartComponent {
  readonly series = input.required<ChartSeries[]>()
  readonly slots = input(60)
  readonly height = input(64)
  readonly ariaLabel = input('')
  /** Draw the first series as bars instead of a line. */
  readonly bars = input(false)
  readonly width = WIDTH

  readonly max = computed(() =>
    chartMax(this.series().flatMap((line) => line.values))
  )
  readonly paths = computed(() =>
    this.series().map((line) => ({
      label: line.label,
      color: line.color,
      d: linePath(
        line.values,
        WIDTH,
        this.height() - 2,
        this.max(),
        this.slots()
      )
    }))
  )
  readonly barRects = computed(() => {
    const values = this.series()[0]?.values ?? []
    const slot = WIDTH / this.slots()
    const offset = this.slots() - values.length
    const max = this.max()
    return values
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => Number.isFinite(value) && value > 0)
      .map(({ value, index }) => {
        const h = Math.max(
          2,
          (Math.min(value, max) / max) * (this.height() - 2)
        )
        return {
          x: (offset + index) * slot,
          y: this.height() - h,
          w: Math.max(1, slot - 1),
          h
        }
      })
  })
}
