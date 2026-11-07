import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import { ToastService } from '../core/toast.service'
import { transcribe } from '../tools/dictation/dictation.service'
import {
  RecorderError,
  VoiceRecorder,
  blobToDataUrl,
  isRecordingSupported
} from '../tools/dictation/voice-recorder'
import { ChatSessionStore } from './chat-session.store'

export type VoiceState = 'idle' | 'recording' | 'transcribing'

/** The composer mic: records speech and turns it into the message text. */
@Injectable()
export class VoiceInputStore {
  readonly #session = inject(ChatSessionStore)
  readonly #toast = inject(ToastService)
  readonly #document = inject(DOCUMENT)
  readonly #recorder = new VoiceRecorder()

  readonly state = signal<VoiceState>('idle')
  readonly elapsedMs = signal(0)
  readonly level = signal(0)
  /** The help box shows the first time the mic is clicked. */
  readonly showHelp = signal(false)
  #helpShown = false

  readonly isAvailable = computed(() => {
    const features = this.#session.features()
    return (
      (features.voiceInput || this.#session.selectedTool() === 'dictation') &&
      isRecordingSupported()
    )
  })
  readonly elapsedLabel = computed(() => {
    const seconds = Math.floor(this.elapsedMs() / 1000)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  })

  constructor() {
    this.#document.addEventListener('keydown', this.#onKey, true)
    inject(DestroyRef).onDestroy(() => {
      this.#document.removeEventListener('keydown', this.#onKey, true)
      this.#recorder.cancel()
    })
  }

  async start(): Promise<void> {
    if (this.state() !== 'idle' || this.#session.isBusy()) return
    if (!this.#helpShown) {
      this.#helpShown = true
      this.showHelp.set(true)
    }
    this.elapsedMs.set(0)
    try {
      await this.#recorder.start({
        onTick: (ms) => this.elapsedMs.set(ms),
        onLevel: (level) => this.level.set(level),
        onLimit: () => void this.finish()
      })
      this.state.set('recording')
    } catch (error) {
      this.state.set('idle')
      const strings = this.#session.strings()
      this.#toast.error(
        error instanceof RecorderError && error.code === 'denied'
          ? strings.micDenied
          : strings.captureFailed
      )
    }
  }

  /** Stops and turns the speech into text (or runs Dictation). */
  async finish(): Promise<void> {
    if (this.state() !== 'recording') return
    this.state.set('transcribing')
    try {
      const blob = await this.#recorder.stop()
      if (!blob) return
      const audio = await blobToDataUrl(blob)
      if (this.#session.selectedTool() === 'dictation') {
        this.state.set('idle')
        this.#session.audio.set(audio)
        await this.#session.send()
        return
      }
      const text = await transcribe(this.#session.ai, audio)
      if (!text) {
        this.#toast.show(this.#session.strings().noSpeechHeard)
        return
      }
      const current = this.#session.prompt().trim()
      this.#session.prompt.set(current ? `${current} ${text}` : text)
    } catch (error) {
      this.#toast.error(
        error instanceof Error
          ? error.message
          : this.#session.strings().responseFailed
      )
    } finally {
      this.state.set('idle')
      this.level.set(0)
      this.showHelp.set(false)
    }
  }

  cancel(): void {
    if (this.state() !== 'recording') return
    this.#recorder.cancel()
    this.state.set('idle')
    this.level.set(0)
    this.showHelp.set(false)
  }

  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.state() === 'recording') this.cancel()
  }
}
