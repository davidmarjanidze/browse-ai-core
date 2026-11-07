import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core'
import { ICONS, IconName } from './icons'

/** An SVG icon from Font Awesome Free (CC BY 4.0). */
@Component({
  selector: 'bac-icon',
  templateUrl: './icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center',
    'aria-hidden': 'true'
  }
})
export class IconComponent {
  readonly name = input.required<IconName>()

  readonly #definition = computed(() => ICONS[this.name()].icon)
  readonly viewBox = computed(() => {
    const [width, height] = this.#definition()
    return `0 0 ${width} ${height}`
  })
  readonly paths = computed(() => {
    const data = this.#definition()[4]
    return Array.isArray(data) ? data : [data]
  })
}
