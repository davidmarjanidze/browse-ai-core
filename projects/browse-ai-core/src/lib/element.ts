import type {
  BrowseAiCoreConfig,
  ChatMode,
  ChatPosition,
  ThemeMode
} from './config'
import type { BrowseAiCoreEventMap } from './events'
import type { PaletteName } from './palettes'

export const BROWSE_AI_CORE_TAG = 'browse-ai-core'

/** The `<browse-ai-core>` custom element. */
export interface BrowseAiCoreElement extends HTMLElement {
  config: BrowseAiCoreConfig
  theme: ThemeMode | undefined
  palette: PaletteName | undefined
  position: ChatPosition | undefined
  mode: ChatMode | undefined
  /** Whether the chat panel is open. Set it to open or close the panel. */
  open: boolean
  addEventListener<K extends keyof BrowseAiCoreEventMap>(
    type: K,
    listener: (
      this: BrowseAiCoreElement,
      event: BrowseAiCoreEventMap[K]
    ) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener<K extends keyof BrowseAiCoreEventMap>(
    type: K,
    listener: (
      this: BrowseAiCoreElement,
      event: BrowseAiCoreEventMap[K]
    ) => void,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
}
