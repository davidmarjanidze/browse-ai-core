import { createCustomElement } from '@angular/elements'
import { createApplication } from '@angular/platform-browser'
import { BROWSE_AI_CORE_TAG } from 'browse-ai-core'
import { BrowseAiCoreComponent } from 'browse-ai-core/angular'

/**
 * Registers <browse-ai-core>. Properties set on the element before this
 * finishes are picked up when it upgrades.
 */
async function define(): Promise<void> {
  if (
    typeof customElements === 'undefined' ||
    customElements.get(BROWSE_AI_CORE_TAG)
  ) {
    return
  }
  const app = await createApplication()
  if (customElements.get(BROWSE_AI_CORE_TAG)) return

  customElements.define(
    BROWSE_AI_CORE_TAG,
    createCustomElement(BrowseAiCoreComponent, { injector: app.injector })
  )
}

define().catch((error: unknown) => {
  console.error('browse-ai-core: could not register the element', error)
})
