import { Component, signal } from '@angular/core'
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

  setPalette(event: Event): void {
    this.palette.set((event.target as HTMLSelectElement).value as PaletteName)
  }

  setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as ThemeMode)
  }
}
