import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core'
import { FormField, form, maxLength } from '@angular/forms/signals'
import {
  PALETTE_NAMES,
  PaletteName,
  ThemeMode,
  getThemeTokens
} from 'browse-ai-core'
import { BookmarkService } from '../../bookmarks/bookmark.service'
import { ConfigStore } from '../../core/config.store'
import { SelectionActionsService } from '../../page/selection-actions.service'
import { Personalization } from '../../core/storage-data'
import { StorageService } from '../../core/storage.service'
import { ThemeStore } from '../../core/theme.store'
import { ToastService } from '../../core/toast.service'
import { ButtonComponent } from '../../ui/button/button.component'
import { SwitchComponent } from '../../ui/switch/switch.component'
import {
  ToggleGroupComponent,
  ToggleOption
} from '../../ui/toggle-group/toggle-group.component'

export const NICKNAME_MAX = 50
export const INSTRUCTIONS_MAX = 400

@Component({
  selector: 'bac-settings-panel',
  imports: [FormField, ButtonComponent, SwitchComponent, ToggleGroupComponent],
  templateUrl: './settings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' }
})
export class SettingsPanelComponent {
  readonly theme = inject(ThemeStore)
  readonly bookmarks = inject(BookmarkService)
  readonly selectionActions = inject(SelectionActionsService)
  readonly #storage = inject(StorageService)
  readonly #toast = inject(ToastService)
  readonly #configStore = inject(ConfigStore)
  readonly t = this.#configStore.strings
  readonly features = this.#configStore.features
  readonly nicknameMax = NICKNAME_MAX
  readonly instructionsMax = INSTRUCTIONS_MAX

  readonly model = signal<Personalization>({
    nickname: '',
    customInstructions: ''
  })
  readonly personalization = form(this.model, (path) => {
    maxLength(path.nickname, NICKNAME_MAX)
    maxLength(path.customInstructions, INSTRUCTIONS_MAX)
  })

  readonly themeOptions = computed<ToggleOption<ThemeMode>[]>(() => [
    { label: this.t().themeLight, value: 'light' },
    { label: this.t().themeDark, value: 'dark' },
    { label: this.t().themeSystem, value: 'system' }
  ])
  readonly palettes = computed(() =>
    PALETTE_NAMES.map((name) => ({
      name,
      color: getThemeTokens(name, this.theme.mode()).primary
    }))
  )

  constructor() {
    void this.#storage
      .loadPersonalization()
      .then((value) => this.model.set(value))
  }

  setTheme(theme: ThemeMode): void {
    this.theme.setTheme(theme)
  }

  setPalette(palette: PaletteName): void {
    this.theme.setPalette(palette)
  }

  async save(): Promise<void> {
    if (this.personalization().invalid()) return
    await this.#storage.setPersonalization(this.model())
    this.#toast.success(this.t().settingsSaved)
  }
}
