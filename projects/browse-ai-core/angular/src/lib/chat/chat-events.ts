import { Injectable } from '@angular/core'
import {
  AgentFinishedEvent,
  AgentStepEvent,
  MessageSentEvent,
  ResponseReceivedEvent,
  WatchMatchedEvent
} from 'browse-ai-core'
import { Subject } from 'rxjs'

/** Events the root component turns into outputs (and DOM events). */
@Injectable()
export class ChatEvents {
  readonly messageSent = new Subject<MessageSentEvent>()
  readonly responseReceived = new Subject<ResponseReceivedEvent>()
  readonly errorOccurred = new Subject<Error>()
  readonly agentStep = new Subject<AgentStepEvent>()
  readonly agentFinished = new Subject<AgentFinishedEvent>()
  readonly watchMatched = new Subject<WatchMatchedEvent>()
}
