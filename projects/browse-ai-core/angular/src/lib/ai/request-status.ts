import { computed, signal } from '@angular/core'

export interface TrackedRequest {
  awaitingFirstChunk: boolean
  showsThinking: boolean
}

/**
 * Counts running requests so the UI knows when the model is generating,
 * waiting for its first chunk, or "thinking" (the animated header).
 */
export class RequestStatus {
  readonly #active = signal(0)
  readonly #awaitingFirstChunk = signal(0)
  readonly #thinking = signal(0)

  readonly isGenerating = computed(() => this.#active() > 0)
  readonly isAwaitingFirstChunk = computed(() => this.#awaitingFirstChunk() > 0)
  readonly isThinking = computed(() => this.#thinking() > 0)

  begin(showsThinking: boolean): TrackedRequest {
    this.#active.update((count) => count + 1)
    this.#awaitingFirstChunk.update((count) => count + 1)
    if (showsThinking) this.#thinking.update((count) => count + 1)
    return { awaitingFirstChunk: true, showsThinking }
  }

  firstChunk(request: TrackedRequest): void {
    this.#settleFirstChunk(request)
  }

  end(request: TrackedRequest): void {
    this.#settleFirstChunk(request)
    this.#active.update((count) => Math.max(0, count - 1))
  }

  #settleFirstChunk(request: TrackedRequest): void {
    if (request.awaitingFirstChunk) {
      request.awaitingFirstChunk = false
      this.#awaitingFirstChunk.update((count) => Math.max(0, count - 1))
    }
    if (request.showsThinking) {
      request.showsThinking = false
      this.#thinking.update((count) => Math.max(0, count - 1))
    }
  }
}
