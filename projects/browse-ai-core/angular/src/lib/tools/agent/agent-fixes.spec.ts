import type { AgentToolContext } from './agent-tool-base'
import { AGENT_TOOLS } from './agent-tools'
import { MORE_AGENT_TOOLS } from './agent-tools-more'
import { typeText } from './page-actions'
import { RefMap } from './page-snapshot'

function context(refs = new RefMap()): AgentToolContext {
  return {
    doc: document,
    host: null,
    refs,
    signal: new AbortController().signal,
    screenshot: async () => undefined,
    askUser: async () => '',
    notify: () => undefined,
    remember: () => undefined,
    openTab: async () => 'opened'
  }
}

const tool = (name: string) =>
  [...AGENT_TOOLS, ...MORE_AGENT_TOOLS].find((entry) => entry.name === name)!

describe('agent fixes from the Gemini Nano runs (T-012, T-015)', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('types into number and date inputs', () => {
    document.body.innerHTML =
      '<input type="number" aria-label="Years" /><input type="date" aria-label="Start" />'
    const [years, start] = document.querySelectorAll('input')
    expect(typeText(years, '8')).toBe('8')
    expect(years.value).toBe('8')
    typeText(start, '2026-11-12')
    expect(start.value).toBe('2026-11-12')
  })

  it('fill_form accepts field labels as keys', async () => {
    document.body.innerHTML = `
      <label for="n">Full Legal Name</label><input id="n" />
      <label for="y">Years of Professional Experience</label><input id="y" type="number" />
      <label for="b">Professional Summary</label><textarea id="b"></textarea>`
    const refs = new RefMap()
    for (const element of document.querySelectorAll('input, textarea'))
      refs.add(element)
    const result = await tool('fill_form').run(
      {
        fields: {
          'Full Legal Name': 'John Doe',
          'Years of Professional Experience': '8',
          'professional summary': 'Builds web apps.'
        }
      },
      context(refs)
    )
    expect(result).not.toContain('error')
    const [name, years] = document.querySelectorAll('input')
    expect(name.value).toBe('John Doe')
    expect(years.value).toBe('8')
    expect(document.querySelector('textarea')!.value).toBe('Builds web apps.')
  })

  it('fill_form fails, so the step shows as error, when no field was filled', async () => {
    document.body.innerHTML = '<input aria-label="Name" />'
    const refs = new RefMap()
    refs.add(document.querySelector('input')!)
    await expect(
      Promise.resolve().then(() =>
        tool('fill_form').run(
          { fields: { Nickname: 'x', '99': 'y' } },
          context(refs)
        )
      )
    ).rejects.toThrow(
      /No field was filled[\s\S]*No single listed field is called "Nickname"/u
    )
  })

  it('type_text says the text was not sent yet', async () => {
    document.body.innerHTML = '<input type="search" aria-label="Search" />'
    const refs = new RefMap()
    const ref = refs.add(document.querySelector('input')!)
    const typed = await tool('type_text').run(
      { ref, text: 'green nature' },
      context(refs)
    )
    expect(typed).toContain('call press_key with key Enter')
    const sent = await tool('type_text').run(
      { ref, text: 'green nature', submit: true },
      context(refs)
    )
    expect(sent).not.toContain('Nothing is sent yet')
  })
})
