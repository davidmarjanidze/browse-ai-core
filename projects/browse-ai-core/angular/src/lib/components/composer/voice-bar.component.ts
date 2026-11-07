import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { formatString } from 'browse-ai-core'
import { VoiceInputStore } from '../../chat/voice-input.store'
import { ConfigStore } from '../../core/config.store'
import { ButtonComponent } from '../../ui/button/button.component'
import { HelpBoxComponent } from '../../ui/help-box/help-box.component'

/** Timer, level meter and Stop / Cancel while the mic records. */
@Component({
  selector: 'bac-voice-bar',
  imports: [ButtonComponent, HelpBoxComponent],
  templateUrl: './voice-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class VoiceBarComponent {
  readonly voice = inject(VoiceInputStore)
  readonly t = inject(ConfigStore).strings
  readonly levelPercent = computed(() => Math.round(this.voice.level() * 100))
  readonly recordingLabel = computed(() =>
    formatString(this.t().recording, { time: this.voice.elapsedLabel() })
  )
}
