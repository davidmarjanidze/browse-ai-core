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
}
