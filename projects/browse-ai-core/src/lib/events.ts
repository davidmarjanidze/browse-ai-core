import type { ThemeMode } from './config'

export interface MessageSentEvent {
  text: string
  hasImage: boolean
  hasAudio: boolean
}

export interface ResponseReceivedEvent {
  text: string
}

export interface ThemeChangeEvent {
  theme: ThemeMode
  /** The mode in use after `system` is resolved. */
  mode: 'light' | 'dark'
}

/** One finished Agent Mode step. */
export interface AgentStepEvent {
  step: number
  tool: string
  args: Record<string, unknown>
  /** `ok`, `error` or `denied`, then a short text. */
  result: string
}

export interface AgentFinishedEvent {
  status: 'done' | 'failed' | 'stopped' | 'limit'
  summary: string
}

/** Watch Mode found the change the user asked for. */
export interface WatchMatchedEvent {
  instruction: string
  previous: string
  current: string
  message: string
  confidence: number
}

/**
 * DOM events fired by the `<browse-ai-core>` element. The payload is in
 * `event.detail`.
 */
export interface BrowseAiCoreEventMap {
  opened: CustomEvent<void>
  closed: CustomEvent<void>
  messageSent: CustomEvent<MessageSentEvent>
  responseReceived: CustomEvent<ResponseReceivedEvent>
  errorOccurred: CustomEvent<Error>
  themeChange: CustomEvent<ThemeChangeEvent>
  openChange: CustomEvent<boolean>
  agentStep: CustomEvent<AgentStepEvent>
  agentFinished: CustomEvent<AgentFinishedEvent>
  watchMatched: CustomEvent<WatchMatchedEvent>
}
