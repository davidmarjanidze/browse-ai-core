import { TestBed } from '@angular/core/testing'
import { AiPromptInput } from 'browse-ai-core'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { VoiceInputStore } from '../../chat/voice-input.store'
import { VoiceRecorder } from './voice-recorder'

const AUDIO = 'data:audio/webm;base64,AAAA'

class FakeRecorder {
  static last: FakeRecorder | null = null
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeRecorder.last = this
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({
      data: new Blob(['sound'], { type: 'audio/webm' })
    })
    this.onstop?.()
  }
}

function installMedia(deny = false) {
  const stopped: string[] = []
  const track = { stop: () => stopped.push('track') }
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        if (deny) throw new DOMException('no', 'NotAllowedError')
        return { getTracks: () => [track] }
      }
    }
  })
  return stopped
}

describe('VoiceRecorder', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('records, returns the audio and stops the mic', async () => {
    const stopped = installMedia()
    const recorder = new VoiceRecorder()
    await recorder.start()
    expect(recorder.isRecording).toBe(true)
    const blob = await recorder.stop()
    expect(blob?.size).toBeGreaterThan(0)
    expect(stopped).toEqual(['track'])
  })

  it('drops the audio on cancel and reports denied access', async () => {
    installMedia()
    const recorder = new VoiceRecorder()
    await recorder.start()
    recorder.cancel()
    expect(await recorder.stop()).toBeNull()

    installMedia(true)
    await expectAsync(new VoiceRecorder().start(), 'denied')
  })
})

async function expectAsync(promise: Promise<unknown>, code: string) {
  let error: unknown = null
  await promise.catch((caught: unknown) => (error = caught))
  expect((error as { code?: string })?.code).toBe(code)
}

describe('voice input and Dictation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function setup(reply: (input: AiPromptInput) => string) {
    installMedia()
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    const voice = TestBed.inject(VoiceInputStore)
    TestBed.tick()
    await flush()
    return { session, voice, fake }
  }

  it('asks the model for audio input and puts the text in the composer', async () => {
    const { session, voice, fake } = await setup(() => 'hello there')
    expect(voice.isAvailable()).toBe(true)
    session.prompt.set('Say')
    await voice.start()
    expect(voice.state()).toBe('recording')
    expect(voice.showHelp()).toBe(true)
    await voice.finish()
    expect(session.prompt()).toBe('Say hello there')
    expect(fake.sessions[0].expectedInputs).toContain('audio')
    expect(voice.state()).toBe('idle')
    expect(promptText(fake.inputs[0])).toContain('Write exactly what is said')
    expect(session.messages()).toEqual([])
  })

  it('cancels with Escape', async () => {
    const { voice } = await setup(() => 'x')
    await voice.start()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(voice.state()).toBe('idle')
  })

  it('types the speech into the picked box, applying a command', async () => {
    document.body.innerHTML = '<textarea id="box">Note:</textarea>'
    const { session, voice, fake } = await setup((input) =>
      promptText(input).includes('Change the text')
        ? 'Dear team, I am late.'
        : 'hey team im late'
    )
    const box = document.getElementById('box') as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(5, 5)
    session.selectTool('dictation')
    expect(session.canSend()).toBe(false)
    session.prompt.set('make it formal')
    await voice.start()
    await voice.finish()
    await flush()
    expect(box.value).toBe('Note: Dear team, I am late.')
    expect(promptText(fake.inputs[1])).toContain('make it formal')
    expect(session.messages()[0].audios?.length).toBe(1)
  })

  it('shows the text in the chat when no box is picked', async () => {
    const { session } = await setup(() => 'spoken words')
    session.selectTool('dictation')
    session.audio.set(AUDIO)
    await session.send()
    expect(session.messages()[1].content).toContain('No text box was picked')
    expect(session.messages()[1].content).toContain('spoken words')
  })
})
