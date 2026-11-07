import { Personalization } from '../core/storage-data'
import { PageContextInfo } from '../page/page-context.model'

export interface PromptParts {
  userPrompt: string
  page: PageContextInfo
  includePageContext: boolean
  personalization?: Personalization
  /** Tool prompts are sent as they are, without page wrappers. */
  agentMode: boolean
  hasImage: boolean
  hasAudio: boolean
}

const SELECTION_COMMANDS =
  /^(explain|summarize|describe|analyze|translate|rewrite)$/iu

export function scopePromptToSelection(userPrompt: string): string {
  const prompt = userPrompt.trim()
  const command = prompt.replace(/[.!?]+$/u, '')

  if (SELECTION_COMMANDS.test(command)) {
    return `${command} the selected text only.`
  }
  return `${prompt}\nApply this request only to the selected text.`
}

export function buildPersonalizationPrompt(
  personalization: Personalization | undefined
): string {
  if (!personalization) return ''
  const parts: string[] = []
  const nickname = personalization.nickname.trim()
  const instructions = personalization.customInstructions.trim()

  if (nickname) {
    parts.push(
      `The user's name is "${nickname}". Address them by this name where it fits naturally.`
    )
  }
  if (instructions) {
    parts.push(
      `User preferences:\n${instructions}\n\nAlways keep these preferences in mind.`
    )
  }

  return parts.length > 0 ? `[USER PERSONALIZATION]\n${parts.join('\n\n')}` : ''
}

function buildSelectionPrompt(
  userPrompt: string,
  page: PageContextInfo,
  selection: string
): string[] {
  return [
    'IMPORTANT: The user selected text on the page. The selected text is the only subject of the request.',
    `Task: ${scopePromptToSelection(userPrompt)}`,
    `Selected text:\n${selection}`,
    'Use the following page text only as background needed to understand the selection. Do not answer about the page generally.',
    `Background page text:\n${page.mainText}`,
    'Final instruction: Answer the task about the selected text only. Do not summarize or explain the full page.'
  ]
}

function buildStandardPrompt(
  userPrompt: string,
  page: PageContextInfo,
  includePageContext: boolean
): string[] {
  if (!includePageContext) {
    return [
      'Answer the user as a general-purpose assistant. No web page context is provided.',
      `User message:\n${userPrompt}`
    ]
  }
  return [
    'Answer the user using the web page context below.',
    `Web page context:\n${page.mainText}`,
    `User message:\n${userPrompt}`
  ]
}

function buildMediaPrompt(hasImage: boolean, hasAudio: boolean): string {
  const label = [hasImage && 'image', hasAudio && 'audio']
    .filter(Boolean)
    .join(' and ')
  return `IMPORTANT: ${label} is attached. Use the attached ${label} as the primary source of truth and respond from what you can directly observe or infer from it.`
}

/**
 * Builds the text prompt. When media is attached, the page context and
 * selection are left out so the model focuses on the attachment.
 */
export function buildPrompt(parts: PromptParts): string {
  const hasMedia = parts.hasImage || parts.hasAudio
  const selection = hasMedia ? undefined : parts.page.selectedText?.trim()
  const includePageContext = hasMedia ? false : parts.includePageContext
  const sections: string[] = []

  const personalization = buildPersonalizationPrompt(parts.personalization)
  if (personalization) sections.push(personalization)

  if (parts.agentMode) {
    sections.push(parts.userPrompt)
  } else if (selection) {
    sections.push(
      ...buildSelectionPrompt(parts.userPrompt, parts.page, selection)
    )
  } else {
    sections.push(
      ...buildStandardPrompt(parts.userPrompt, parts.page, includePageContext)
    )
  }

  if (hasMedia) sections.push(buildMediaPrompt(parts.hasImage, parts.hasAudio))

  return sections.join('\n\n')
}
