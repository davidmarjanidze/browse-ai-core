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
