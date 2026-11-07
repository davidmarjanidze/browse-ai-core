import type {
  AiAvailability,
  AiInputType,
  AiSessionOptions
} from './ai-provider'
import type { BrowseAiCoreConfig, ResolvedBrowseAiCoreConfig } from './config'
import { resolveConfig } from './config'

/** Session options the chat uses for a config: AI options and input types. */
export function getSessionOptions(
  config: ResolvedBrowseAiCoreConfig
): AiSessionOptions {
  const { ai, features } = config
  const expectedInputs: AiInputType[] = ['text']
  if (features.imageInput || features.screenCapture)
    expectedInputs.push('image')
  if (features.audioInput || features.voiceInput || features.dictation)
    expectedInputs.push('audio')

  return {
    systemPrompt: ai.systemPrompt,
    temperature: ai.temperature,
    topK: ai.topK,
    initialPrompts: ai.initialPrompts,
    outputLanguage: ai.outputLanguage,
    expectedInputs
  }
}

/**
 * The model's availability for a config, checked the same way as the chat.
 * Returns `'unavailable'` when the check throws.
 */
export async function getAiAvailability(
  config?: BrowseAiCoreConfig | ResolvedBrowseAiCoreConfig
): Promise<AiAvailability> {
  const resolved = resolveConfig(config as BrowseAiCoreConfig)
  try {
    return await resolved.aiProvider.availability(getSessionOptions(resolved))
  } catch {
    return 'unavailable'
  }
}

/**
 * Whether the AI features work on this device. `false` is the case where the
 * chat shows "AI features are not supported in this browser."
 */
export async function isAiSupported(
  config?: BrowseAiCoreConfig | ResolvedBrowseAiCoreConfig
): Promise<boolean> {
  return (await getAiAvailability(config)) !== 'unavailable'
}
