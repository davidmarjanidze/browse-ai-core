import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ExtraToolRunner } from '../../chat/extra-tool-runner'
import { FormControlElement } from '../form-filler/form-field.model'
import { checkFields, formFields, parseExpiry, pickForm } from './form-rules'
import { buildExplainPrompt, parseExplanations } from './form-validator.service'

const rules = (html: string, now = new Date(2026, 10, 7)) => {
  document.body.innerHTML = `<form>${html}</form>`
  return checkFields(formFields(document.forms[0]), now).map((problem) => [
    problem.element.id,
    problem.rule
  ])
}

describe('form rules', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('uses the browser validity flags', () => {
    expect(
      rules(`
        <input id="name" required>
        <input id="mail" type="email" value="nope">
        <input id="zip" pattern="\\d{5}" value="12">
        <input id="age" type="number" min="18" value="12">
        <input id="ok" value="fine">`)
    ).toEqual([
      ['name', 'valueMissing'],
      ['mail', 'typeMismatch'],
      ['zip', 'patternMismatch'],
      ['age', 'rangeUnderflow']
    ])
  })

  it('checks soft rules: email-like text fields, confirm fields, spaces and past expiry', () => {
    expect(
      rules(`
        <label for="e">Email</label><input id="e" value="bob.example.com">
        <input id="pw" type="password" value="secret1">
        <label for="pw2">Confirm password</label><input id="pw2" type="password" value="secret2">
        <input id="city" value=" Paris">
        <label for="exp">Expiry date</label><input id="exp" value="01/25">`)
    ).toEqual([
      ['e', 'email'],
      ['pw2', 'confirm'],
      ['city', 'spaces'],
      ['exp', 'pastDate']
    ])
  })

  it('checks only required, length and confirm on password fields', () => {
    expect(
      rules('<input id="pw" type="password" value=" x " minlength="8">')
    ).toEqual([['pw', 'tooShort']])
  })

  it('reads expiry dates and picks the largest form', () => {
    expect(parseExpiry('2024-05')).toEqual(new Date(2024, 5, 0))
    expect(parseExpiry('05/2030')).toEqual(new Date(2030, 5, 0))
    expect(parseExpiry('soon')).toBeNull()
    document.body.innerHTML =
      '<form id="a"><input></form><form id="b"><input><input></form>'
    expect((pickForm(document, null) as HTMLElement).id).toBe('b')
    expect((pickForm(document, document.forms[0]) as HTMLElement).id).toBe('a')
  })

  it('never puts password values in the prompt', () => {
    document.body.innerHTML =
      '<form><input id="pw" type="password" value="hunter2" minlength="10"><input id="n" value="Bob" minlength="5"></form>'
    const prompt = buildExplainPrompt(
      checkFields(formFields(document.forms[0]))
    )
    expect(prompt).not.toContain('hunter2')
    expect(prompt).toContain('(hidden)')
    expect(prompt).toContain('"Bob"')
    expect(
      parseExplanations(
        '{"messages":[{"index":0,"message":"Too short"},{"index":5,"message":"x"}]}',
        2
      )
    ).toEqual(new Map([[0, 'Too short']]))
  })
})

describe('Form Validator tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function run(reply: string) {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('form-validator')
    await session.send()
    return { session, fake, runner: TestBed.inject(ExtraToolRunner) }
  }

  it('lists problems, marks fields and removes a marker when fixed', async () => {
    document.body.innerHTML =
      '<form><label for="n">Name</label><input id="n" required><label for="e">Email</label><input id="e" type="email" value="x"></form>'
    const { session, fake, runner } = await run(
      '{"messages":[{"index":0,"message":"Please enter your name."}]}'
    )
    expect(promptText(fake.inputs[0])).toContain('Rule broken: valueMissing')
    const answer = session.messages()[1]
    expect(answer.content).toBe('2 problem(s) found in the form:')
    const card = answer.card as {
      kind: 'form-issues'
      issues: { label: string; message: string }[]
    }
    expect(card.issues.map((issue) => [issue.label, issue.message])).toEqual([
      ['Name', 'Please enter your name.'],
      ['Email', 'The value is not in the right format.']
    ])
    expect(runner.form.markerCount).toBe(2)
    expect(
      document.querySelector('[data-browse-ai-core-markers]')
    ).not.toBeNull()

    const name = document.getElementById('n') as FormControlElement
    name.value = 'Ann'
    name.dispatchEvent(new Event('input'))
    expect(runner.form.markerCount).toBe(1)

    runner.form.clear()
    expect(document.querySelector('[data-browse-ai-core-markers]')).toBeNull()
  })

  it('says the form looks fine, or that there is no form', async () => {
    document.body.innerHTML = '<form><input value="ok"></form>'
    const first = await run('{}')
    expect(first.session.messages()[1].content).toBe(
      'No problems found in the form.'
    )
    expect(first.fake.inputs.length).toBe(0)
  })

  it('answers noFormFields without fields', async () => {
    document.body.innerHTML = '<p>No form</p>'
    const { session } = await run('{}')
    expect(session.messages()[1].content).toBe(
      'No form fields with labels were found on this page.'
    )
  })
})
