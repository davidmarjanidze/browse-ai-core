import { AiPromptInput, AiSession } from 'browse-ai-core'
import { isQuotaExceededError } from './stream-reader'

/** How many schemas of the list each session has rejected. */
const rejected = new WeakMap<AiSession, number>()

/**
 * Prompts with a JSON schema (`responseConstraint`). If the provider rejects
 * the option, it tries the next schema of the list, then no schema, and
 * remembers that for the session. The answer is always checked by the caller.
 */
export async function promptWithSchema(
  session: AiSession,
  input: AiPromptInput,
  schema: object | readonly object[],
  signal: AbortSignal
): Promise<string> {
  const schemas = (
    Array.isArray(schema) ? schema : [schema]
  ) as readonly object[]
  for (;;) {
    const index = rejected.get(session) ?? 0
    const next = schemas[index]
    if (!next) break
    try {
      return await session.prompt(input, { signal, responseConstraint: next })
    } catch (error) {
      if (signal.aborted || isQuotaExceededError(error)) throw error
      const name = error instanceof Error ? error.name : ''
      if (name !== 'NotSupportedError' && name !== 'TypeError') throw error
      rejected.set(session, index + 1)
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
