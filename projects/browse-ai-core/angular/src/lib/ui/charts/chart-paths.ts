/** SVG path for a line through `values`. NaN values leave a gap. */
export function linePath(
  values: number[],
  width: number,
  height: number,
  max: number,
  slots = values.length
): string {
  if (values.length === 0 || max <= 0) return ''
  const step = slots > 1 ? width / (slots - 1) : 0
  const offset = slots - values.length
  let path = ''
  let drawing = false
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      drawing = false
      return
    }
    const x = (offset + index) * step
    const y = height - (Math.min(value, max) / max) * height
    path += `${drawing ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `
    drawing = true
  })
  return path.trim()
}

/** Highest finite value, at least `floor`, so flat lines stay at the bottom. */
export function chartMax(values: number[], floor = 1): number {
  const finite = values.filter(Number.isFinite)
  return Math.max(floor, ...finite)
}

export function chartStats(values: number[]): {
  last: number
  min: number
  max: number
} {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return { last: 0, min: 0, max: 0 }
  return {
    last: finite[finite.length - 1],
    min: Math.min(...finite),
    max: Math.max(...finite)
  }
}
