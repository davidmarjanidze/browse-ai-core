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

  setPalette(event: Event): void {
    this.palette.set((event.target as HTMLSelectElement).value as PaletteName)
  }

  setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as ThemeMode)
  }
}
