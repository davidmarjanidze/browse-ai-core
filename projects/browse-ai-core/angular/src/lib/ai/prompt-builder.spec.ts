import { emptyPageContext } from '../page/page-context.model'
import {
  buildPersonalizationPrompt,
  buildPrompt,
  scopePromptToSelection
} from './prompt-builder'

const page = { ...emptyPageContext(), mainText: 'PAGE TEXT' }
const base = {
  userPrompt: 'What is this?',
  page,
  includePageContext: true,
  agentMode: false,
  hasImage: false,
  hasAudio: false
}

describe('prompt builder', () => {
  it('includes page text when page context is on', () => {
    const prompt = buildPrompt(base)
    expect(prompt).toContain('Web page context:\nPAGE TEXT')
    expect(prompt).toContain('User message:\nWhat is this?')
  })

  it('leaves the page out in general mode', () => {
    const prompt = buildPrompt({ ...base, includePageContext: false })
    expect(prompt).not.toContain('PAGE TEXT')
    expect(prompt).toContain('general-purpose assistant')
  })

  it('focuses on selected text', () => {
    const prompt = buildPrompt({
      ...base,
      userPrompt: 'Explain',
      page: { ...page, selectedText: 'abc' }
    })
    expect(prompt).toContain('Selected text:\nabc')
    expect(prompt).toContain('Task: Explain the selected text only.')
  })

  it('ignores page and selection when media is attached', () => {
    const prompt = buildPrompt({
      ...base,
      hasImage: true,
      page: { ...page, selectedText: 'abc' }
    })
    expect(prompt).not.toContain('PAGE TEXT')
    expect(prompt).not.toContain('abc')
    expect(prompt).toContain('image is attached')
  })

  it('sends tool prompts as they are', () => {
    expect(buildPrompt({ ...base, agentMode: true, userPrompt: 'RAW' })).toBe(
      'RAW'
    )
  })

  it('adds personalization first', () => {
    const prompt = buildPrompt({
      ...base,
      personalization: { nickname: 'Ana', customInstructions: 'Be brief' }
    })
    expect(prompt.startsWith('[USER PERSONALIZATION]')).toBe(true)
    expect(prompt).toContain('"Ana"')
    expect(prompt).toContain('Be brief')
    expect(
      buildPersonalizationPrompt({ nickname: ' ', customInstructions: '' })
    ).toBe('')
  })

  it('scopes requests to the selection', () => {
    expect(scopePromptToSelection('summarize.')).toBe(
      'summarize the selected text only.'
    )
    expect(scopePromptToSelection('make it formal')).toContain(
      'Apply this request only'
    )
  })
})
