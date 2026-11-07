import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core'
import { ComposerContextComponent } from './composer-context.component'
import { ComposerInputComponent } from './composer-input.component'
import { ComposerToolbarComponent } from './composer-toolbar.component'

@Component({
  selector: 'bac-composer',
  imports: [
    ComposerToolbarComponent,
    ComposerContextComponent,
    ComposerInputComponent
  ],
  templateUrl: './composer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' }
})
export class ComposerComponent {
  protected readonly input = viewChild.required(ComposerInputComponent)

  focus(): void {
    this.input().focus()
  }
}
