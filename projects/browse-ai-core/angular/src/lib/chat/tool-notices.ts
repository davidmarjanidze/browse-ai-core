import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

export interface ToolNotice {
  text: string
  error?: boolean
}

/**
 * Messages that long-running tools (Agent Mode, Watch Mode) post to the chat
 * on their own, outside a request and answer.
 */
@Injectable()
export class ToolNotices {
  readonly posted = new Subject<ToolNotice>()

  post(text: string, error = false): void {
    this.posted.next({ text, error })
  }
}
