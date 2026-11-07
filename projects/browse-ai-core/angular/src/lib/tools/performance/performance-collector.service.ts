import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { describeElement } from '../dom-to-component/dom-inspector.service'
import {
  MetricId,
  RingBuffer,
  Shift,
  clsFromShifts,
  inpFromInteractions,
  tbtFromLongTasks
} from './metrics'

export const WINDOW_SECONDS = 60
const SAMPLE_MS = 1000

export interface ResourceInfo {
  url: string
  type: string
  sizeKb: number
  durationMs: number
}

export interface PerformanceSeries {
  busy: number[]
  interaction: number[]
  shifts: number[]
  heap: number[]
}

type Entry = PerformanceEntry & Record<string, unknown>

/**
 * Collects performance data while the chat is on the page: Core Web Vitals,
 * long tasks, resources, and a 60-second series sampled once per second.
 */
@Injectable()
export class PerformanceCollectorService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #features = inject(ConfigStore).features
  readonly #observers: PerformanceObserver[] = []
  #timer: ReturnType<typeof setInterval> | undefined

  readonly #shifts: Shift[] = []
  readonly #interactions = new Map<number, number>()
  readonly #longTasks: { startTime: number; duration: number }[] = []
  readonly #resources: ResourceInfo[] = []
  #lcp: { value: number; element: Element | null } | null = null
  #fcp: number | null = null
  #ttfb: number | null = null
  readonly supported = new Set<string>()

  readonly #buffers = {
    busy: new RingBuffer(WINDOW_SECONDS),
    interaction: new RingBuffer(WINDOW_SECONDS),
    shifts: new RingBuffer(WINDOW_SECONDS),
    heap: new RingBuffer(WINDOW_SECONDS)
  }
  #window = { busy: 0, interaction: 0, shifts: 0 }
  #lastSample = 0

  /** Bumped on every sample, so views update once per second. */
  readonly tick = signal(0)
  readonly paused = signal(false)
  readonly series = computed<PerformanceSeries>(() => {
    this.tick()
    return {
      busy: this.#buffers.busy.toArray(),
      interaction: this.#buffers.interaction.toArray(),
      shifts: this.#buffers.shifts.toArray(),
      heap: this.#buffers.heap.toArray()
    }
  })
  readonly metrics = computed<Record<MetricId, number | null>>(() => {
    this.tick()
    return {
      lcp: this.#lcp?.value ?? null,
      inp: inpFromInteractions([...this.#interactions.values()]),
      cls: this.supported.has('layout-shift')
        ? clsFromShifts(this.#shifts)
        : null,
      ttfb: this.#ttfb,
      fcp: this.#fcp,
      tbt: this.supported.has('longtask')
        ? tbtFromLongTasks(this.#longTasks, this.#fcp ?? 0)
        : null
    }
  })
  readonly largestResources = computed(() => {
    this.tick()
    return [...this.#resources].sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 10)
  })
  readonly slowestResources = computed(() => {
    this.tick()
    return [...this.#resources]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10)
  })
  readonly hasHeap = computed(() =>
    this.series().heap.some((value) => value > 0)
  )

  constructor() {
    if (this.#features().performanceExplainer) this.start()
    inject(DestroyRef).onDestroy(() => this.stop())
  }

  get lcpElement(): Element | null {
    return this.#lcp?.element?.isConnected ? this.#lcp.element : null
  }

  get longTaskCount(): number {
    return this.#longTasks.length
  }

  get longTaskTotal(): number {
    return this.#longTasks.reduce((sum, task) => sum + task.duration, 0)
  }

  start(): void {
    if (this.#timer || typeof PerformanceObserver === 'undefined') return
    const types = PerformanceObserver.supportedEntryTypes ?? []
    const watch = (
      type: string,
      handle: (entry: Entry) => void,
      extra: object = {}
    ) => {
      if (!types.includes(type)) return
      this.supported.add(type)
      try {
        const observer = new PerformanceObserver((list) =>
          list.getEntries().forEach((entry) => handle(entry as Entry))
        )
        observer.observe({
          type,
          buffered: true,
          ...extra
        } as PerformanceObserverInit)
        this.#observers.push(observer)
      } catch {
        this.supported.delete(type)
      }
    }
    watch(
      'largest-contentful-paint',
      (entry) =>
        (this.#lcp = {
          value: entry.startTime,
          element: (entry['element'] as Element | null) ?? null
        })
    )
    watch('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') this.#fcp = entry.startTime
    })
    watch(
      'navigation',
      (entry) => (this.#ttfb = Number(entry['responseStart']) || null)
    )
    watch('layout-shift', (entry) => this.#onShift(entry))
    watch('event', (entry) => this.#onEvent(entry), { durationThreshold: 16 })
    watch('longtask', (entry) => {
      this.#longTasks.push({
        startTime: entry.startTime,
        duration: entry.duration
      })
      this.#window.busy += entry.duration
    })
    if (!this.supported.has('longtask')) {
      watch(
        'long-animation-frame',
        (entry) => (this.#window.busy += Number(entry['blockingDuration']) || 0)
      )
    }
    watch('resource', (entry) => this.#onResource(entry))
    this.#lastSample = Date.now()
    this.#timer = setInterval(() => this.sample(), SAMPLE_MS)
  }

  stop(): void {
    this.#observers.forEach((observer) => observer.disconnect())
    this.#observers.length = 0
    clearInterval(this.#timer)
    this.#timer = undefined
  }

  /** Pushes one point per series. Exported for tests. */
  sample(now = Date.now()): void {
    // Background tabs slow timers down; missed seconds are drawn as gaps.
    const missed = Math.min(
      WINDOW_SECONDS,
      Math.floor((now - this.#lastSample) / SAMPLE_MS) - 1
    )
    this.#lastSample = now
    if (this.paused()) {
      this.#window = { busy: 0, interaction: 0, shifts: 0 }
      return
    }
    for (let i = 0; i < missed; i++) {
      Object.values(this.#buffers).forEach((buffer) => buffer.push(Number.NaN))
    }
    const memory = (
      performance as Performance & { memory?: { usedJSHeapSize: number } }
    ).memory
    this.#buffers.busy.push(Math.min(1000, Math.round(this.#window.busy)))
    this.#buffers.interaction.push(Math.round(this.#window.interaction))
    this.#buffers.shifts.push(Math.round(this.#window.shifts * 1000) / 1000)
    this.#buffers.heap.push(
      memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0
    )
    this.#window = { busy: 0, interaction: 0, shifts: 0 }
    this.tick.update((value) => value + 1)
  }

  reset(): void {
    Object.values(this.#buffers).forEach((buffer) => buffer.clear())
    this.tick.update((value) => value + 1)
  }

  /** LCP element as `tag#id.class`, for prompts. */
  lcpDescription(): string {
    const element = this.lcpElement
    if (!element) return ''
    const text = element.textContent?.trim().slice(0, 60) ?? ''
    const src = element.getAttribute('src') ?? ''
    return [
      describeElement(element),
      src && `src=${src.split('?')[0]}`,
      text && `"${text}"`
    ]
      .filter(Boolean)
      .join(' ')
  }

  #inHost(node: unknown): boolean {
    return (
      node instanceof Node && (node === this.#host || this.#host.contains(node))
    )
  }

  #onShift(entry: Entry): void {
    if (entry['hadRecentInput']) return
    const sources =
      (entry['sources'] as { node?: Node | null }[] | undefined) ?? []
    if (sources.length && sources.every((source) => this.#inHost(source.node)))
      return
    const value = Number(entry['value']) || 0
    this.#shifts.push({ startTime: entry.startTime, value })
    this.#window.shifts += value
  }

  #onEvent(entry: Entry): void {
    const id = Number(entry['interactionId'])
    if (!id || this.#inHost(entry['target'])) return
    this.#interactions.set(
      id,
      Math.max(this.#interactions.get(id) ?? 0, entry.duration)
    )
    this.#window.interaction = Math.max(
      this.#window.interaction,
      entry.duration
    )
  }

  #onResource(entry: Entry): void {
    if (/browse-ai-core/iu.test(entry.name)) return
    const size =
      Number(entry['transferSize']) || Number(entry['encodedBodySize']) || 0
    this.#resources.push({
      url: entry.name,
      type: String(entry['initiatorType'] ?? ''),
      sizeKb: Math.round(size / 102.4) / 10,
      durationMs: Math.round(entry.duration)
    })
    if (this.#resources.length > 500)
      this.#resources.splice(0, this.#resources.length - 500)
  }
}
