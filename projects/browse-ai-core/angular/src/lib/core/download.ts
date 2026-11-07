/** Saves text as a file through a temporary link. */
export function downloadText(
  doc: Document,
  fileName: string,
  text: string,
  type = 'text/markdown'
): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = doc.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A short random id for saved records. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Splits text into parts of at most `size` characters, on spaces when possible. */
export function splitText(text: string, size: number): string[] {
  const parts: string[] = []
  let rest = text.trim()
  while (rest.length > size) {
    let cut = rest.lastIndexOf(' ', size)
    if (cut < size / 2) cut = size
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}
