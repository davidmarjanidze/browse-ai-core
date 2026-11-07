export type MetricId = 'lcp' | 'inp' | 'cls' | 'ttfb' | 'fcp' | 'tbt'
export type Rating = 'good' | 'needs-work' | 'poor'

export const METRIC_IDS: readonly MetricId[] = [
  'lcp',
  'inp',
  'cls',
  'ttfb',
  'fcp',
  'tbt'
]

/** Google's good / poor limits. Time metrics are in milliseconds. */
export const THRESHOLDS: Record<MetricId, [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  ttfb: [800, 1800],
  fcp: [1800, 3000],
  tbt: [200, 600]
}

export const METRIC_NAMES: Record<MetricId, string> = {
  lcp: 'LCP',
  inp: 'INP',
  cls: 'CLS',
  ttfb: 'TTFB',
  fcp: 'FCP',
  tbt: 'TBT'
}

export function rate(metric: MetricId, value: number): Rating {
  const [good, poor] = THRESHOLDS[metric]
  if (value <= good) return 'good'
  return value <= poor ? 'needs-work' : 'poor'
}

export function formatMetric(metric: MetricId, value: number): string {
  if (metric === 'cls') return value.toFixed(3)
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} s`
    : `${Math.round(value)} ms`
}

export interface Shift {
  startTime: number
  value: number
}

/**
 * CLS as web-vitals computes it: shifts are grouped into session windows
 * (gaps under 1 s, windows up to 5 s) and the largest window counts.
 */
export function clsFromShifts(shifts: Shift[]): number {
  let max = 0
  let current = 0
  let first = 0
  let last = 0
  for (const shift of [...shifts].sort((a, b) => a.startTime - b.startTime)) {
    if (
      current &&
      shift.startTime - last < 1000 &&
      shift.startTime - first < 5000
    ) {
      current += shift.value
    } else {
      current = shift.value
      first = shift.startTime
    }
    last = shift.startTime
    max = Math.max(max, current)
  }
  return max
}

/**
 * INP from the longest duration of each interaction: the worst one, but
 * one is skipped for every 50 interactions (about the 98th percentile).
 */
export function inpFromInteractions(durations: number[]): number | null {
  if (durations.length === 0) return null
  const sorted = [...durations].sort((a, b) => b - a)
  const skip = Math.min(sorted.length - 1, Math.floor(sorted.length / 50))
  return sorted[skip]
}

/** Total blocking time: the part over 50 ms of each long task after FCP. */
export function tbtFromLongTasks(
  tasks: { startTime: number; duration: number }[],
  fcp = 0
): number {
  return tasks
    .filter((task) => task.startTime >= fcp)
    .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)
}

/** Fixed-size list that drops the oldest value when full. */
export class RingBuffer {
  readonly #values: number[] = []
  constructor(readonly size: number) {}

  push(value: number): void {
    this.#values.push(value)
    if (this.#values.length > this.size) this.#values.shift()
  }

  clear(): void {
    this.#values.length = 0
  }

  toArray(): number[] {
    return [...this.#values]
  }
}

/** URL without query string or hash, for prompts. */
export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.origin + parsed.pathname
  } catch {
    return url.split(/[?#]/u)[0]
  }
}
