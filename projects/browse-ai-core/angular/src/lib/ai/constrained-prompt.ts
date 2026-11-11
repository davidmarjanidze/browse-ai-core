import { AiPromptInput, AiSession } from 'browse-ai-core'
import { isQuotaExceededError } from './stream-reader'

const unsupported = new WeakSet<AiSession>()

/**
 * Prompts with a JSON schema (`responseConstraint`). If the provider rejects
 * the option, it asks again without it and remembers that for the session.
 * The answer is always checked by the caller.
 */
export async function promptWithSchema(
  session: AiSession,
  input: AiPromptInput,
  schema: object,
  signal: AbortSignal
): Promise<string> {
  if (!unsupported.has(session)) {
    try {
      return await session.prompt(input, { signal, responseConstraint: schema })
    } catch (error) {
      if (signal.aborted || isQuotaExceededError(error)) throw error
      const name = error instanceof Error ? error.name : ''
      if (name !== 'NotSupportedError' && name !== 'TypeError') throw error
      unsupported.add(session)
    }
  }
  return session.prompt(input, { signal })
}

/** True when the session has used more than `limit` of its context. */
export function isSessionNearlyFull(session: AiSession, limit = 0.75): boolean {
  const legacy = session as { inputUsage?: number; inputQuota?: number }
  const used = session.contextUsage ?? legacy.inputUsage
  const total = session.contextWindow ?? legacy.inputQuota
  return (
    used !== undefined &&
    total !== undefined &&
    total > 0 &&
    used / total > limit
  )
}
