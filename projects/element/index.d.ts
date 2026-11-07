import type { BrowseAiCoreElement } from 'browse-ai-core'

/**
 * Importing 'browse-ai-core/element' registers the <browse-ai-core> custom
 * element. Use `customElements.whenDefined('browse-ai-core')` to wait for it.
 */
export type { BrowseAiCoreElement }

declare global {
  interface HTMLElementTagNameMap {
    'browse-ai-core': BrowseAiCoreElement
  }
}
