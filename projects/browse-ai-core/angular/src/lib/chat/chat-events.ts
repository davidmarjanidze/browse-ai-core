import { Injectable } from '@angular/core'
import { MessageSentEvent, ResponseReceivedEvent } from 'browse-ai-core'
import { Subject } from 'rxjs'

/** Events the root component turns into outputs (and DOM events). */
@Injectable()
export class ChatEvents {
  readonly messageSent = new Subject<MessageSentEvent>()
  readonly responseReceived = new Subject<ResponseReceivedEvent>()
  readonly errorOccurred = new Subject<Error>()
}
