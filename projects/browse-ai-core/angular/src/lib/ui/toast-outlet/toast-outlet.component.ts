import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ToastService } from '../../core/toast.service'

@Component({
  selector: 'bac-toast-outlet',
  templateUrl: './toast-outlet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none absolute inset-x-3 bottom-3 z-[70] flex flex-col items-center gap-2',
    'aria-live': 'polite'
  }
})
export class ToastOutletComponent {
  readonly toasts = inject(ToastService).toasts
}
