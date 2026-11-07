import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'

export interface ToggleOption<T extends string = string> {
  label: string
  value: T
}

/** A row of buttons where one is selected, like radio buttons. */
@Component({
  selector: 'bac-toggle-group',
  templateUrl: './toggle-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' }
})
export class ToggleGroupComponent<T extends string = string> {
  readonly options = input.required<ToggleOption<T>[]>()
  readonly value = model.required<T>()
  readonly ariaLabel = input('')
  readonly disabled = input(false)

  select(value: T): void {
    if (!this.disabled()) this.value.set(value)
  }
}
