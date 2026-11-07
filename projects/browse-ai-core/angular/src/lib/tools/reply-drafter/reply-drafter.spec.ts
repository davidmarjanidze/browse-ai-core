import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ExtraToolRunner } from '../../chat/extra-tool-runner'
import { FieldTrackerService } from '../../page/field-tracker.service'
import {
  insertAtCursor,
  isTextField,
  setFieldValue
} from '../../page/insert-text'
import { nearbyText } from './reply-drafter.service'

const POST = 'This is the original post that the user wants to answer. '.repeat(
  5
)

describe('page text helpers', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('finds the text above a reply box', () => {
    document.body.innerHTML = `<article><p>${POST}</p><textarea id="box"></textarea></article>`
    expect(nearbyText(document.getElementById('box')!)).toContain(
      'original post'
    )
  })

  it('accepts text boxes but not password or card fields', () => {
    document.body.innerHTML = `
      <textarea id="a"></textarea><input id="b" type="text"><input id="c" type="password">
      <input id="d" autocomplete="cc-number"><div id="e" contenteditable="true"></div><input id="f" type="checkbox">`
    const ok = (id: string) => isTextField(document.getElementById(id))
    expect([ok('a'), ok('b'), ok('c'), ok('d'), ok('e'), ok('f')]).toEqual([
      true,
      true,
      false,
      false,
      true,
      false
    ])
  })

  it('sets values with input and change events', () => {
    document.body.innerHTML = '<textarea id="box"></textarea>'
    const box = document.getElementById('box') as HTMLTextAreaElement
    const events: string[] = []
    box.addEventListener('input', () => events.push('input'))
    box.addEventListener('change', () => events.push('change'))
    setFieldValue(box, 'Hello')
    expect(box.value).toBe('Hello')
    expect(events).toEqual(['input', 'change'])
  })

  it('inserts at the cursor with a space', () => {
    document.body.innerHTML = '<input id="box" value="Hello world">'
    const box = document.getElementById('box') as HTMLInputElement
    box.setSelectionRange(5, 5)
    insertAtCursor(box, 'there')
    expect(box.value).toBe('Hello there world')
    box.setSelectionRange(0, 0)
    insertAtCursor(box, 'Oh')
    expect(box.value).toBe('Oh Hello there world')
  })
})

describe('Reply Drafter tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function setup(reply = 'Thanks for the post!') {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    return { session, fake, runner: TestBed.inject(ExtraToolRunner) }
  }

  async function send(session: ChatSessionStore, text = '') {
    session.selectTool('reply-drafter')
    session.prompt.set(text)
    await session.send()
  }

  it('asks for a box first and does not call the model', async () => {
    const { session, fake } = await setup()
    await send(session)
    expect(session.messages()[1].content).toBe(
      'Pick the text box for the reply first.'
    )
    expect(fake.inputs.length).toBe(0)
  })

  it('drafts from the text near the box and inserts on request', async () => {
    document.body.innerHTML = `<article><p>${POST}</p><label for="box">Comment</label><textarea id="box"></textarea></article>`
    const { session, fake, runner } = await setup()
    const box = document.getElementById('box') as HTMLTextAreaElement
    box.focus()
    expect(TestBed.inject(FieldTrackerService).fieldLabel()).toBe('Comment')
    runner.reply.tone.set('formal')
    await send(session, 'say thanks')
    const prompt = promptText(fake.inputs[0])
    expect(prompt).toContain('original post')
    expect(prompt).toContain('TONE: formal')
    expect(prompt).toContain('USER INSTRUCTIONS: say thanks')
    const answer = session.messages()[1]
    expect(answer.content).toBe('Thanks for the post!')
    expect(answer.card).toEqual({ kind: 'reply', fieldLabel: 'Comment' })
    expect(runner.reply.needsChoice()).toBe(false)
    expect(runner.reply.insert(answer.content)).toBe(true)
    expect(box.value).toBe('Thanks for the post!')
  })

  it('asks to replace or add when the box has text, and adds to the end', async () => {
    document.body.innerHTML = `<p>${POST}</p><textarea id="box">Draft</textarea>`
    const { session, runner } = await setup()
    const box = document.getElementById('box') as HTMLTextAreaElement
    box.focus()
    await send(session)
    expect(runner.reply.needsChoice()).toBe(true)
    runner.reply.insert('Reply', 'append')
    expect(box.value).toBe('Draft\n\nReply')
  })

  it('cuts to maxlength and says when the box is gone', async () => {
    document.body.innerHTML = `<p>${POST}</p><input id="box" maxlength="5">`
    const { session, runner } = await setup()
    ;(document.getElementById('box') as HTMLInputElement).focus()
    await send(session)
    runner.reply.insert('Thanks for the post!')
    expect((document.getElementById('box') as HTMLInputElement).value).toBe(
      'Thank'
    )
    document.body.innerHTML = ''
    expect(runner.reply.insert('x')).toBe(false)
  })
})
