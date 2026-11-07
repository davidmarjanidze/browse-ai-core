import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { FormatPipe } from '../../core/format.pipe'
import { TablesDownloadFormat } from '../../tools/tables/table-formats'
import { ButtonComponent } from '../../ui/button/button.component'
import { IconComponent } from '../../ui/icon/icon.component'
import { MenuComponent, MenuItem } from '../../ui/menu/menu.component'
import { ModelDownloadComponent } from '../model-download/model-download.component'

/** Everything shown above the input: attachments, selection, tool results. */
@Component({
  selector: 'bac-composer-context',
  imports: [
    ButtonComponent,
    IconComponent,
    MenuComponent,
    ModelDownloadComponent,
    FormatPipe
  ],
  templateUrl: './composer-context.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class ComposerContextComponent {
  readonly session = inject(ChatSessionStore)
  readonly t = this.session.strings

  readonly formatItems = computed<MenuItem<TablesDownloadFormat>[]>(() => [
    { label: this.t().downloadCsv, value: 'csv' },
    { label: this.t().downloadExcel, value: 'excel' },
    { label: this.t().downloadJson, value: 'json' },
    { label: this.t().downloadMarkdown, value: 'markdown' }
  ])
}
