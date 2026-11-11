import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import {
  ChatPosition,
  ColorMode,
  PaletteName,
  ThemeMode,
  buildThemeCss
} from 'browse-ai-core'
import { ConfigStore } from './config.store'
import { ChatSide } from './storage-data'
import { StorageService } from './storage.service'

/**
 * Resolves the theme mode, palette and side. A choice the user saved in settings
 * wins over the config, as long as the appearance feature is on.
 */
@Injectable()
export class ThemeStore {
  readonly #configStore = inject(ConfigStore)
  readonly #storage = inject(StorageService)
  readonly #savedTheme = signal<ThemeMode | undefined>(undefined)
  readonly #savedPalette = signal<PaletteName | undefined>(undefined)
  readonly #savedSide = signal<ChatSide | undefined>(undefined)
  readonly #systemDark = signal(false)

  readonly theme = computed<ThemeMode>(() => {
    const { theme, features } = this.#configStore.config()
    return (features.appearance && this.#savedTheme()) || theme
  })
  readonly palette = computed<PaletteName>(() => {
    const { palette, features } = this.#configStore.config()
    return (features.appearance && this.#savedPalette()) || palette
  })
  /** The configured corner, moved to the side the user saved in settings. */
  readonly position = computed<ChatPosition>(() => {
    const { position, features } = this.#configStore.config()
    const side = features.appearance ? this.#savedSide() : undefined
    if (!side) return position
    return `${position.startsWith('top') ? 'top' : 'bottom'}-${side}`
  })
  readonly side = computed<ChatSide>(() =>
    this.position().endsWith('left') ? 'left' : 'right'
  )
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
    this.#savedSide.set(appearance.side)
  }

  setSide(side: ChatSide): void {
    this.#savedSide.set(side)
    void this.#storage.setAppearance({ side })
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
