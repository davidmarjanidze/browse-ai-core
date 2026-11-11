import { TestBed } from '@angular/core/testing'
import {
  BUILT_IN_TOOL_IDS,
  DEFAULT_FEATURES,
  DEFAULT_STRINGS
} from 'browse-ai-core'
import { SelectComponent, groupOptions } from '../ui/select/select.component'
import { TOOL_GROUPS } from './tool-groups'
import { getTools } from './tools.model'

const allTools = () =>
  getTools(
    {
      ...DEFAULT_FEATURES,
      domToComponent: true,
      agentMode: true,
      watchMode: true
    },
    DEFAULT_STRINGS,
    () => true
  )

describe('tool groups', () => {
  it('puts every tool in exactly one group', () => {
    const grouped = TOOL_GROUPS.flatMap((group) => group.tools)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual(
      allTools()
        .map((tool) => tool.id)
        .sort()
    )
    for (const tool of BUILT_IN_TOOL_IDS) expect(grouped).toContain(tool)
  })

  it('lists tools by group, with Forms first and Agents second', () => {
    const tools = allTools()
    expect(tools.slice(0, 4).map((tool) => [tool.id, tool.group])).toEqual([
      ['form-filler', 'Forms'],
      ['form-validator', 'Forms'],
      ['agent-mode', 'Agents'],
      ['watch-mode', 'Agents']
    ])
    const headings = groupOptions(
      tools.map((tool) => ({
        label: tool.name,
        value: tool.id,
        group: tool.group
      }))
    ).map((group) => group.label)
    expect(headings).toEqual([
      'Forms',
      'Agents',
      'Read & understand',
      'Write',
      'Save & extract',
      'Safety',
      'Developer'
    ])
  })

  it('keeps Agent Mode and Watch Mode off by default', () => {
    const ids = getTools(DEFAULT_FEATURES, DEFAULT_STRINGS).map(
      (tool) => tool.id
    )
    expect(ids).not.toContain('agent-mode')
    expect(ids).not.toContain('watch-mode')
  })

  it('drops headings of groups with no tools turned on', () => {
    const tools = getTools(
      { ...DEFAULT_FEATURES, phishingCheck: false, darkPatternDetector: false },
      DEFAULT_STRINGS
    )
    expect(tools.some((tool) => tool.group === 'Safety')).toBe(false)
  })
})

describe('SelectComponent groups', () => {
  it('shows headings that cannot be chosen, and options under them', () => {
    const fixture = TestBed.createComponent(SelectComponent<string | null>)
    fixture.componentRef.setInput('options', [
      { label: 'No tool', value: null },
      { label: 'Form Filler', value: 'a', group: 'Forms' },
      { label: 'Form Validator', value: 'b', group: 'Forms' },
      { label: 'Summarizer', value: 'c', group: 'Read & understand' }
    ])
    fixture.detectChanges()
    const root = fixture.nativeElement as HTMLElement
    root.querySelector<HTMLButtonElement>('button')!.click()
    fixture.detectChanges()
    const groups = [...root.querySelectorAll('[role="group"]')]
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Forms',
      'Read & understand'
    ])
    const options = [...root.querySelectorAll('[role="option"]')]
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'No tool',
      'Form Filler',
      'Form Validator',
      'Summarizer'
    ])
    expect(groups[0].querySelectorAll('[role="option"]').length).toBe(2)
    ;(options[2] as HTMLButtonElement).click()
    expect(fixture.componentInstance.value()).toBe('b')
  })
})
