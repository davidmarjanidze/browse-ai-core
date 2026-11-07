import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core'

/** Download button with progress bar, size note and error. */
@Component({
  selector: 'bac-model-download',
  templateUrl: './model-download.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class ModelDownloadComponent {
  readonly label = input.required<string>()
  /** Button text while downloading, with the percent already filled in. */
  readonly downloadingLabel = input.required<string>()
  readonly isDownloading = input(false)
  readonly progress = input(0)
  readonly note = input<string | null>(null)
  readonly error = input<string | null>(null)
  readonly download = output<void>()
}
