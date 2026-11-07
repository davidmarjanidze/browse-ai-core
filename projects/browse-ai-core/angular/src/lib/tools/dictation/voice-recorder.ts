export const MAX_RECORDING_MS = 60_000

export type RecorderErrorCode = 'denied' | 'unsupported'

export class RecorderError extends Error {
  constructor(readonly code: RecorderErrorCode) {
    super(code)
  }
}

export interface RecorderCallbacks {
  /** Elapsed milliseconds, about 4 times per second. */
  onTick?: (elapsedMs: number) => void
  /** Input level from 0 to 1. */
  onLevel?: (level: number) => void
  /** Called when the 60-second limit stops the recording. */
  onLimit?: () => void
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

/**
 * Records the microphone with MediaRecorder. The tracks are stopped as soon
 * as recording ends, so the browser's mic indicator goes off.
 */
export class VoiceRecorder {
  #stream: MediaStream | null = null
  #recorder: MediaRecorder | null = null
  #chunks: Blob[] = []
  #timer: ReturnType<typeof setInterval> | undefined
  #limit: ReturnType<typeof setTimeout> | undefined
  #audio: AudioContext | null = null
  #frame = 0
  #done: ((blob: Blob | null) => void) | null = null
  #canceled = false

  async start(callbacks: RecorderCallbacks = {}): Promise<void> {
    if (!isRecordingSupported()) throw new RecorderError('unsupported')
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new RecorderError('denied')
    }
    this.#chunks = []
    this.#canceled = false
    const recorder = new MediaRecorder(this.#stream)
    this.#recorder = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.#chunks.push(event.data)
    }
    recorder.onstop = () => {
      const blob =
        this.#canceled || this.#chunks.length === 0
          ? null
          : new Blob(this.#chunks, { type: recorder.mimeType || 'audio/webm' })
      this.#cleanup()
      this.#done?.(blob)
      this.#done = null
    }
    recorder.start()

    const started = Date.now()
    this.#timer = setInterval(
      () => callbacks.onTick?.(Date.now() - started),
      250
    )
    this.#limit = setTimeout(() => {
      callbacks.onLimit?.()
    }, MAX_RECORDING_MS)
    this.#watchLevel(callbacks.onLevel)
  }

  get isRecording(): boolean {
    return this.#recorder?.state === 'recording'
  }

  /** Stops and returns the recording, or null when nothing was recorded. */
  stop(): Promise<Blob | null> {
    const recorder = this.#recorder
    if (!recorder || recorder.state === 'inactive') {
      this.#cleanup()
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      this.#done = resolve
      recorder.stop()
    })
  }

  /** Stops and drops the recording. */
  cancel(): void {
    this.#canceled = true
    void this.stop()
  }

  #watchLevel(onLevel?: (level: number) => void): void {
    const Context = (globalThis as { AudioContext?: typeof AudioContext })
      .AudioContext
    if (!onLevel || !Context || !this.#stream) return
    try {
      this.#audio = new Context()
      const analyser = this.#audio.createAnalyser()
      analyser.fftSize = 256
      this.#audio.createMediaStreamSource(this.#stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const read = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const value of data)
          peak = Math.max(peak, Math.abs(value - 128) / 128)
        onLevel(peak)
        this.#frame = requestAnimationFrame(read)
      }
      read()
    } catch {
      this.#audio = null
    }
  }

  #cleanup(): void {
    clearInterval(this.#timer)
    clearTimeout(this.#limit)
    cancelAnimationFrame(this.#frame)
    void this.#audio?.close().catch(() => undefined)
    this.#audio = null
    this.#stream?.getTracks().forEach((track) => track.stop())
    this.#stream = null
    this.#recorder = null
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
