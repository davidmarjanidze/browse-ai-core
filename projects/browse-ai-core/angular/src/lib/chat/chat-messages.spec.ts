import {
  StreamState,
  appendChunk,
  completeAnswer,
  createUserMessage,
  failAnswer
} from './chat-messages'

const newState = (): StreamState => ({ content: '', messageAdded: false })

describe('chat messages', () => {
  it('creates the answer on the first chunk and updates it after', () => {
    const state = newState()
    let messages = [createUserMessage('Hi')]
    messages = appendChunk(messages, state, 'Hel')
    messages = appendChunk(messages, state, 'lo')
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      sender: 'assistant',
      content: 'Hello',
      isStreaming: true
    })
  })

  it('completes the streamed answer', () => {
    const state = newState()
    const messages = appendChunk([createUserMessage('Hi')], state, 'Hel')
    const done = completeAnswer(messages, state, 'Hello', {
      formFillerData: []
    })
    expect(done[1]).toMatchObject({
      content: 'Hello',
      isStreaming: false,
      formFillerData: []
    })
  })

  it('adds the answer when nothing streamed and drops empty answers', () => {
    const messages = [createUserMessage('Hi')]
    expect(completeAnswer(messages, newState(), 'Done')).toHaveLength(2)
    expect(completeAnswer(messages, newState(), '  ')).toHaveLength(1)
  })

  it('keeps partial text when stopped', () => {
    const state = newState()
    const messages = appendChunk([createUserMessage('Hi')], state, 'Partial')
    const stopped = failAnswer(messages, state, 'Stopped', true)
    expect(stopped[1]).toMatchObject({ content: 'Partial', isStreaming: false })
    expect(stopped[1].error).toBeFalsy()
  })

  it('shows errors as an error message', () => {
    const failed = failAnswer(
      [createUserMessage('Hi')],
      newState(),
      'Boom',
      false
    )
    expect(failed[1]).toMatchObject({ content: 'Boom', error: true })
  })

  it('attaches media to user messages', () => {
    expect(createUserMessage('x', 'img', 'aud')).toMatchObject({
      images: ['img'],
      audios: ['aud']
    })
    expect(createUserMessage('x').images).toBeUndefined()
  })
})
