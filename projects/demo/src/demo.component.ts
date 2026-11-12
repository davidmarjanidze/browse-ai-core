import { Component, DestroyRef, inject, signal } from '@angular/core'
import { PALETTE_NAMES, PaletteName, ThemeMode } from 'browse-ai-core'
import { BrowseAiCoreComponent } from 'browse-ai-core/angular'

@Component({
  selector: 'demo-root',
  imports: [BrowseAiCoreComponent],
  templateUrl: './demo.component.html'
})
export class DemoComponent {
  readonly palettes = PALETTE_NAMES
  readonly palette = signal<PaletteName>('indigo')
  readonly theme = signal<ThemeMode>('system')
  readonly open = signal(location.search.includes('open'))

  /** Small shop for trying Agent Mode. */
  readonly products = [
    { name: 'Red shirt', price: 25 },
    { name: 'Blue shirt', price: 19 },
    { name: 'Red shirt (sale)', price: 15 }
  ]
  readonly cart = signal<string[]>([])
  readonly ordered = signal(false)

  /** For trying find_images, close_overlay and wait_for_url. */
  readonly plane =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" fill="#bde"/><path d="M20 45h110l15-8-15-2H95L70 15H60l15 20H35l-10-10h-8l5 20z" fill="#444"/></svg>'
    )
  readonly cookies = signal(true)
  readonly step = signal(1)

  /** Price that changes every 3 seconds, for trying Watch Mode. */
  readonly price = signal(105)

  constructor() {
    const timer = setInterval(
      () =>
        this.price.update((price) =>
          Math.max(80, price + Math.round((Math.random() - 0.55) * 6))
        ),
      3000
    )
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
  }

  addToCart(name: string, size: string): void {
    this.cart.update((cart) => [...cart, `${name} (${size})`])
  }

  /** Changes the address without a page load, like a single-page app. */
  nextStep(event: Event): void {
    event.preventDefault()
    this.step.update((step) => step + 1)
    history.pushState(null, '', `?step=${this.step()}`)
  }

  setPalette(event: Event): void {
    this.palette.set((event.target as HTMLSelectElement).value as PaletteName)
  }

  setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as ThemeMode)
  }
}
