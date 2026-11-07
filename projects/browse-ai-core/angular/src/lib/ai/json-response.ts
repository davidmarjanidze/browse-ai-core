/** Parses JSON from a model answer, with or without ```json fences. */
export function parseJsonFromModelResponse(content: string): unknown {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

const OPEN_WRAPPER = /^<([a-z][\w-]*)>\s*/iu
const CLOSE_WRAPPER = /\s*<\/[a-z][\w-]*>$/iu

/**
 * Removes tags the model sometimes wraps around its text, such as
 * `<note>…</note>`. Tags inside the text are kept.
 */
export function cleanModelText(text: string): string {
  let result = text.trim()
  for (let i = 0; i < 3; i++) {
    const next = result.replace(OPEN_WRAPPER, '').replace(CLOSE_WRAPPER, '')
    if (next === result) break
    result = next.trim()
  }
  return result
}
