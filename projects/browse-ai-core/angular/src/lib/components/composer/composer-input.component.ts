import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild
} from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { VoiceInputStore } from '../../chat/voice-input.store'
import { SnipCaptureService } from '../../page/snip-capture.service'
import { IconComponent } from '../../ui/icon/icon.component'
import { MenuComponent, MenuItem } from '../../ui/menu/menu.component'
import { AutoResizeTextareaComponent } from '../../ui/textarea/auto-resize-textarea.component'

type AttachmentAction = 'image' | 'visible' | 'region' | 'audio'

const ACTION_CLASSES =
  'flex size-10 pointer-coarse:size-11 shrink-0 items-center justify-center rounded-bac bg-bac-primary text-bac-on-primary transition-colors hover:bg-bac-primary-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bac-primary'

@Component({
  selector: 'bac-composer-input',
  imports: [AutoResizeTextareaComponent, MenuComponent, IconComponent],
  templateUrl: './composer-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-end gap-2' }
})
export class ComposerInputComponent {
  readonly session = inject(ChatSessionStore)
  readonly #snip = inject(SnipCaptureService)
  readonly voice = inject(VoiceInputStore)
  readonly t = this.session.strings
  readonly actionClasses = ACTION_CLASSES

  protected readonly textarea = viewChild.required(AutoResizeTextareaComponent)

  readonly attachmentItems = computed<MenuItem<AttachmentAction>[]>(() => {
    const features = this.session.features()
    const t = this.t()
    const canCapture = features.screenCapture && this.#snip.isAvailable
    const items: (MenuItem<AttachmentAction> | false)[] = [
      features.imageInput && {
        label: t.uploadImage,
        value: 'image',
        icon: 'image'
      },
      canCapture && {
        label: t.captureVisibleArea,
        value: 'visible',
        icon: 'desktop'
      },
      canCapture && { label: t.snipCapture, value: 'region', icon: 'snip' },
      features.audioInput && {
        label: t.uploadAudio,
        value: 'audio',
        icon: 'audio'
      }
    ]
    return items.filter(
      (item): item is MenuItem<AttachmentAction> => item !== false
    )
  })

  readonly attachmentsDisabled = computed(
    () => this.session.isBusy() || !this.session.ai.isModelReady()
  )

  focus(): void {
    this.textarea().focus()
  }

  onAttachment(
    action: AttachmentAction,
    imageInput: HTMLInputElement,
    audioInput: HTMLInputElement
  ): void {
    if (this.attachmentsDisabled()) return
    if (action === 'image') imageInput.click()
    else if (action === 'audio') audioInput.click()
    else void this.session.capture(action)
  }

  onFile(event: Event, kind: 'image' | 'audio'): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) this.session.attachFile(file, kind)
    input.value = ''
  }
}
