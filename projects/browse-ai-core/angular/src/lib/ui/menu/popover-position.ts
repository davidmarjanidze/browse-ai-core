export type OpenDirection = 'auto' | 'up' | 'down'

/** Opens up when there is more room above the trigger than below it. */
export function resolveDirection(
  direction: OpenDirection,
  trigger: HTMLElement | undefined,
  panelHeight: number
): 'up' | 'down' {
  if (direction !== 'auto') return direction
  if (!trigger) return 'down'

  const rect = trigger.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom
  const above = rect.top
  if (below >= panelHeight) return 'down'
  return above > below ? 'up' : 'down'
}
