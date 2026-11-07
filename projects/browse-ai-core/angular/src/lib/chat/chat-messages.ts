import { ChatMessage } from './chat.model'

/** Text received so far for the answer being streamed. */
export interface StreamState {
  content: string
  /** True once the assistant message for this answer is in the list. */
  messageAdded: boolean
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export function createUserMessage(
  content: string,
  image?: string,
  audio?: string
): ChatMessage {
  return {
    id: newId(),
    sender: 'user',
    content,
    timestamp: new Date(),
    ...(image && { images: [image] }),
    ...(audio && { audios: [audio] })
  }
}

export function createAssistantMessage(
  content: string,
  options: { error?: boolean; isStreaming?: boolean } = {}
): ChatMessage {
  return {
    id: newId(),
    sender: 'assistant',
    content,
    timestamp: new Date(),
    error: options.error ?? false,
    isStreaming: options.isStreaming ?? false
  }
}

const last = (messages: ChatMessage[]): ChatMessage | undefined =>
  messages[messages.length - 1]

const replaceLast = (
  messages: ChatMessage[],
  message: ChatMessage
): ChatMessage[] => [...messages.slice(0, -1), message]

/** Adds a chunk to the streaming answer, creating the message on the first one. */
export function appendChunk(
  messages: ChatMessage[],
  state: StreamState,
  chunk: string
): ChatMessage[] {
  state.content += chunk

  if (!state.messageAdded) {
    state.messageAdded = true
    return [
      ...messages,
      createAssistantMessage(state.content, { isStreaming: true })
    ]
  }

  const current = last(messages)
  return current?.sender === 'assistant' && !current.error
    ? replaceLast(messages, { ...current, content: state.content })
    : messages
}

/** Sets the final text of the answer, or adds it if nothing streamed. */
export function completeAnswer(
  messages: ChatMessage[],
  state: StreamState,
  content: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage[] {
  const current = last(messages)

  if (state.messageAdded && current?.sender === 'assistant') {
    if (!content.trim()) return messages.slice(0, -1)
    return replaceLast(messages, {
      ...current,
      ...extra,
      content,
      isStreaming: false,
      error: false
    })
  }
  if (!content.trim()) return messages
  return [...messages, { ...createAssistantMessage(content), ...extra }]
}

/**
 * Shows an error as the answer. When the user stopped the answer, the text
 * received so far is kept instead.
 */
export function failAnswer(
  messages: ChatMessage[],
  state: StreamState,
  errorText: string,
  stopped: boolean
): ChatMessage[] {
  const current = last(messages)
  const hasAnswer = state.messageAdded && current?.sender === 'assistant'

  if (stopped && state.content) {
    return hasAnswer
      ? replaceLast(messages, {
          ...current!,
          content: state.content,
          isStreaming: false
        })
      : messages
  }
  if (hasAnswer) {
    return replaceLast(messages, {
      ...current!,
      content: errorText,
      error: true,
      isStreaming: false
    })
  }
  return [...messages, createAssistantMessage(errorText, { error: true })]
}
