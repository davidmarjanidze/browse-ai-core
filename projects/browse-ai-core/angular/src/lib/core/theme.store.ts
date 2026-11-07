import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import {
  ColorMode,
  PaletteName,
  ThemeMode,
  buildThemeCss
} from 'browse-ai-core'
import { ConfigStore } from './config.store'
import { StorageService } from './storage.service'

/**
 * Resolves the theme mode and palette. A choice the user saved in settings
 * wins over the config, as long as the appearance feature is on.
 */
@Injectable()
export class ThemeStore {
  readonly #configStore = inject(ConfigStore)
  readonly #storage = inject(StorageService)
  readonly #savedTheme = signal<ThemeMode | undefined>(undefined)
  readonly #savedPalette = signal<PaletteName | undefined>(undefined)
  readonly #systemDark = signal(false)

  readonly theme = computed<ThemeMode>(() => {
    const { theme, features } = this.#configStore.config()
    return (features.appearance && this.#savedTheme()) || theme
  })
  readonly palette = computed<PaletteName>(() => {
    const { palette, features } = this.#configStore.config()
    return (features.appearance && this.#savedPalette()) || palette
  })
  readonly mode = computed<ColorMode>(() => {
    const theme = this.theme()
    if (theme !== 'system') return theme
    return this.#systemDark() ? 'dark' : 'light'
  })
  readonly css = computed(() => buildThemeCss(this.palette(), this.mode()))

  constructor() {
    const query = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return

    this.#systemDark.set(query.matches)
    const onChange = (event: MediaQueryListEvent): void =>
      this.#systemDark.set(event.matches)
    query.addEventListener('change', onChange)
    inject(DestroyRef).onDestroy(() =>
      query.removeEventListener('change', onChange)
    )
  }

  async init(): Promise<void> {
    const appearance = await this.#storage.loadAppearance()
    this.#savedTheme.set(appearance.theme)
    this.#savedPalette.set(appearance.palette)
  }

  setTheme(theme: ThemeMode): void {
    this.#savedTheme.set(theme)
    void this.#storage.setAppearance({ theme })
  }

  setPalette(palette: PaletteName): void {
    this.#savedPalette.set(palette)
    void this.#storage.setAppearance({ palette })
  }
}
