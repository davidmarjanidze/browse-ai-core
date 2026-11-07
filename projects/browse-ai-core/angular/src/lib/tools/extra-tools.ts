/**
 * Tools added after the first release (see specs T-002 to T-012). Each one
 * has a feature flag and `<key>Name`, `<key>Description` and `<key>Notes`
 * strings.
 */
export const EXTRA_TOOLS = [
  { id: 'link-inspector', key: 'linkInspector', promptOptional: true },
  { id: 'reply-drafter', key: 'replyDrafter', promptOptional: true },
  { id: 'notes', key: 'notes', promptOptional: true },
  { id: 'review-summarizer', key: 'reviewSummarizer', promptOptional: true },
  { id: 'research-notes', key: 'researchNotes', promptOptional: true },
  { id: 'argument-mapper', key: 'argumentMapper', promptOptional: true },
  { id: 'form-validator', key: 'formValidator', promptOptional: true },
  { id: 'dictation', key: 'dictation', promptOptional: false },
  {
    id: 'performance-explainer',
    key: 'performanceExplainer',
    promptOptional: true
  },
  { id: 'phishing-check', key: 'phishingCheck', promptOptional: true },
  {
    id: 'dark-pattern-detector',
    key: 'darkPatternDetector',
    promptOptional: true
  }
] as const

export type ExtraToolId = (typeof EXTRA_TOOLS)[number]['id']

/** Feature flags of all newer tools turned off. Used by tests and hosts. */
export const EXTRA_TOOLS_OFF = Object.fromEntries(
  EXTRA_TOOLS.map((tool) => [tool.key, false])
) as Record<(typeof EXTRA_TOOLS)[number]['key'], false>

export function isExtraTool(tool: string | null): tool is ExtraToolId {
  return EXTRA_TOOLS.some((entry) => entry.id === tool)
}
