import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { TRANSLATOR_LANGUAGES } from 'browse-ai-core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ContextMode } from '../../chat/chat.model'
import { ConfigStore } from '../../core/config.store'
import { FormatPipe } from '../../core/format.pipe'
import {
  DOM_COMPONENT_FRAMEWORKS,
  DomToComponentFramework,
  ToolId
} from '../../tools/tools.model'
import { IconComponent } from '../../ui/icon/icon.component'
import { SelectComponent, SelectOption } from '../../ui/select/select.component'
import {
  ToggleGroupComponent,
  ToggleOption
} from '../../ui/toggle-group/toggle-group.component'

@Component({
  selector: 'bac-composer-toolbar',
  imports: [ToggleGroupComponent, SelectComponent, IconComponent, FormatPipe],
  templateUrl: './composer-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class ComposerToolbarComponent {
  readonly session = inject(ChatSessionStore)
  readonly #configStore = inject(ConfigStore)
  readonly t = this.session.strings

  readonly contextOptions = computed<ToggleOption<ContextMode>[]>(() => [
    {
      label: this.session.context()?.domain || this.t().contextPage,
      value: 'page'
    },
    { label: this.t().contextGeneral, value: 'general' }
  ])

  readonly toolOptions = computed<SelectOption<ToolId | null>[]>(() => [
    { label: this.t().noTool, value: null },
    ...this.session
      .tools()
      .map((tool) => ({ label: tool.name, value: tool.id }))
  ])

  readonly frameworkOptions: SelectOption<DomToComponentFramework>[] = [
    { label: 'Angular', value: DOM_COMPONENT_FRAMEWORKS.Angular },
    { label: 'React', value: DOM_COMPONENT_FRAMEWORKS.React },
    { label: 'Vue.js', value: DOM_COMPONENT_FRAMEWORKS.VueJs },
    { label: 'JavaScript', value: DOM_COMPONENT_FRAMEWORKS.JavaScript }
  ]

  readonly isBusy = this.session.isBusy

  readonly languageOptions = computed<SelectOption<string>[]>(() => {
    const names = displayNames(this.#configStore.config().ai.outputLanguage)
    const current = this.session.builtIn.targetLanguage()
    const codes = TRANSLATOR_LANGUAGES.includes(current)
      ? TRANSLATOR_LANGUAGES
      : [current, ...TRANSLATOR_LANGUAGES]
    return codes.map((code) => ({
      label: names?.of(code) ?? code,
      value: code
    }))
  })

  setTargetLanguage(value: string | null): void {
    if (value) this.session.builtIn.targetLanguage.set(value)
  }

  setFramework(value: DomToComponentFramework | null): void {
    if (value) this.session.domFramework.set(value)
  }
}

/** Language names in the UI language, or null when Intl can't name them. */
function displayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'language' })
  } catch {
    return null
  }
}
