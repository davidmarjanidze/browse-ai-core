import type { BrowseAiCoreStrings } from 'browse-ai-core'
import type { ToolId } from './tools.model'

/**
 * Groups shown as headings in the tool picker, in display order. Tools are
 * listed in the order given here.
 */
export const TOOL_GROUPS: readonly {
  label: keyof BrowseAiCoreStrings
  tools: readonly ToolId[]
}[] = [
  { label: 'toolGroupAgents', tools: ['agent-mode', 'watch-mode'] },
  { label: 'toolGroupForms', tools: ['form-filler', 'form-validator'] },
  {
    label: 'toolGroupRead',
    tools: [
      'summarizer',
      'translator',
      'argument-mapper',
      'review-summarizer',
      'subject-finder',
      'link-inspector'
    ]
  },
  {
    label: 'toolGroupWrite',
    tools: ['writer', 'rewriter', 'proofreader', 'reply-drafter', 'dictation']
  },
  {
    label: 'toolGroupSave',
    tools: ['notes', 'research-notes', 'tables-extractor', 'image-downloader']
  },
  {
    label: 'toolGroupSafety',
    tools: ['phishing-check', 'dark-pattern-detector']
  },
  {
    label: 'toolGroupDeveloper',
    tools: ['performance-explainer', 'dom-to-component']
  }
]

const ORDER = new Map<
  ToolId,
  { index: number; label: keyof BrowseAiCoreStrings }
>(
  TOOL_GROUPS.flatMap((group) =>
    group.tools.map((tool) => [tool, group.label] as const)
  ).map(([tool, label], index) => [tool, { index, label }])
)

/** Group heading for a tool. */
export function toolGroupLabel(
  tool: ToolId,
  strings: BrowseAiCoreStrings
): string {
  const entry = ORDER.get(tool)
  return entry ? (strings[entry.label] as string) : ''
}

/** Position of a tool in the picker. Unknown tools go last. */
export function toolOrder(tool: ToolId): number {
  return ORDER.get(tool)?.index ?? Number.MAX_SAFE_INTEGER
}
