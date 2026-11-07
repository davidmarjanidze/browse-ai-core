import {
  PALETTE_NAMES,
  ThemeTokens,
  buildThemeCss,
  contrastRatio,
  getThemeTokens,
  isPaletteName
} from './palettes'

const PAIRS: [keyof ThemeTokens, keyof ThemeTokens][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceHover'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryHover'],
  ['accentText', 'accentSoft'],
  ['success', 'successSoft'],
  ['warning', 'warningSoft'],
  ['danger', 'dangerSoft']
]

describe('palettes', () => {
  it('has 10 palettes', () => {
    expect(PALETTE_NAMES).toHaveLength(10)
    expect(new Set(PALETTE_NAMES).size).toBe(10)
  })

  for (const palette of PALETTE_NAMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${palette} ${mode} meets WCAG AA (4.5:1) for text`, () => {
        const tokens = getThemeTokens(palette, mode)
        for (const [foreground, background] of PAIRS) {
          const ratio = contrastRatio(tokens[foreground], tokens[background])
          expect(
            ratio,
            `${foreground} on ${background}`
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }

  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('builds CSS variables for the host', () => {
    const css = buildThemeCss('forest', 'dark')
    expect(css.startsWith(':host{')).toBe(true)
    expect(css).toContain('--bac-primary:#4ade80;')
    expect(css).toContain('--bac-on-primary:#0a0a0b;')
    expect(css).toContain('--bac-surface-hover:')
    expect(css).toContain('color-scheme:dark;')
  })

  it('keeps the original thinking glow colors for forest dark', () => {
    const tokens = getThemeTokens('forest', 'dark')
    expect(tokens.thinking1).toBe('rgba(74, 239, 145, 0.35)')
    expect(tokens.thinking2).toBe('rgba(247, 231, 92, 0.34)')
    expect(tokens.thinking3).toBe('rgba(255, 168, 52, 0.3)')
  })

  it('gives every palette and mode its own thinking glow', () => {
    const glows = new Set<string>()
    for (const palette of PALETTE_NAMES) {
      for (const mode of ['light', 'dark'] as const) {
        const tokens = getThemeTokens(palette, mode)
        for (const key of [
          'thinking1',
          'thinking1Deep',
          'thinking2',
          'thinking2Soft',
          'thinking3',
          'thinking3Soft',
          'thinkingSurface'
        ] as const) {
          expect(tokens[key], `${palette} ${mode} ${key}`).toMatch(
            /^rgba\(\d+, \d+, \d+, (0|1|0\.\d+)\)$/
          )
        }
        glows.add(tokens.thinking1)
      }
    }
    expect(glows.size).toBe(PALETTE_NAMES.length * 2)
  })

  it('sets the thinking blend mode per color mode', () => {
    expect(buildThemeCss('ocean', 'dark')).toContain(
      '--bac-thinking-blend:screen;'
    )
    expect(buildThemeCss('ocean', 'light')).toContain(
      '--bac-thinking-blend:soft-light;'
    )
    expect(buildThemeCss('ocean', 'light')).toContain('--bac-thinking1:rgba(')
  })

  it('checks palette names', () => {
    expect(isPaletteName('teal')).toBe(true)
    expect(isPaletteName('pink')).toBe(false)
  })
})
