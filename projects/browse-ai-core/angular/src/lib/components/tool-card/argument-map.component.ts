import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core'
import { BrowseAiCoreStrings } from 'browse-ai-core'
import { ArgumentMap, Evidence } from '../../chat/tool-card.model'
import { copyText } from '../../core/clipboard'
import { ConfigStore } from '../../core/config.store'
import { ToastService } from '../../core/toast.service'
import {
  ArgumentMapperService,
  argumentToMarkdown
} from '../../tools/argument-mapper/argument-mapper.service'
import { ButtonComponent } from '../../ui/button/button.component'

const EVIDENCE_STRINGS: Record<Evidence, keyof BrowseAiCoreStrings> = {
  quote: 'evidenceQuote',
  data: 'evidenceData',
  source: 'evidenceSource',
  none: 'evidenceNone'
}

/** Points for and against a claim, as two labeled lists. */
@Component({
  selector: 'bac-argument-map',
  imports: [ButtonComponent],
  templateUrl: './argument-map.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Columns follow the card's width, not the window's: the chat panel is
  // narrow even on wide screens.
  host: { class: '@container block w-full' }
})
export class ArgumentMapComponent {
  readonly map = input.required<ArgumentMap>()
  readonly service = inject(ArgumentMapperService)
  readonly #toast = inject(ToastService)
  readonly t = inject(ConfigStore).strings

  readonly groups = computed(() => {
    const strings = this.t()
    const points = this.map().points
    return [
      {
        type: 'support' as const,
        title: strings.supportPoints,
        points: points.filter((p) => p.type === 'support')
      },
      {
        type: 'counter' as const,
        title: strings.counterPoints,
        points: points.filter((p) => p.type === 'counter')
      }
    ].filter((group) => group.points.length)
  })

  /** Quotes found on the page, checked once per map. */
  readonly findable = computed(
    () =>
      new Set(
        this.map()
          .points.map((point) => point.quote)
          .filter((quote) => this.service.canFind(quote))
      )
  )

  evidence(value: Evidence): string {
    return this.t()[EVIDENCE_STRINGS[value]] as string
  }

  async copyMarkdown(): Promise<void> {
    const strings = this.t()
    const text = argumentToMarkdown(this.map(), {
      claim: strings.mainClaim,
      support: strings.supportPoints,
      counter: strings.counterPoints
    })
    if (await copyText(text)) this.#toast.success(strings.copied)
  }
}
