export const PALETTE_NAMES = [
  'indigo',
  'ocean',
  'forest',
  'sunset',
  'rose',
  'violet',
  'amber',
  'slate',
  'teal',
  'crimson'
] as const

export type PaletteName = (typeof PALETTE_NAMES)[number]

export type ColorMode = 'light' | 'dark'

/** Every color the UI uses. Each one is a `--bac-<kebab-name>` CSS variable. */
export interface ThemeTokens {
  bg: string
  surface: string
  surfaceHover: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryHover: string
  onPrimary: string
  accentSoft: string
  accentText: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  /** Moving glow behind the header and messages while the model thinks. */
  thinking1: string
  thinking1Deep: string
  thinking2: string
  thinking2Soft: string
  thinking3: string
  thinking3Soft: string
  thinkingSurface: string
}

type ThinkingTokens = Pick<
  ThemeTokens,
  | 'thinking1'
  | 'thinking1Deep'
  | 'thinking2'
  | 'thinking2Soft'
  | 'thinking3'
  | 'thinking3Soft'
  | 'thinkingSurface'
>

type PaletteColors = Pick<
  ThemeTokens,
  'primary' | 'primaryHover' | 'onPrimary' | 'accentSoft' | 'accentText'
>

const BASE: Record<
  ColorMode,
  Omit<ThemeTokens, keyof PaletteColors | keyof ThinkingTokens>
> = {
  light: {
    bg: '#ffffff',
    surface: '#f4f4f5',
    surfaceHover: '#e4e4e7',
    border: '#d4d4d8',
    text: '#18181b',
    textMuted: '#52525b',
    success: '#166534',
    successSoft: '#dcfce7',
    warning: '#92400e',
    warningSoft: '#fef3c7',
    danger: '#b91c1c',
    dangerSoft: '#fee2e2'
  },
  dark: {
    bg: '#0a0a0b',
    surface: '#18181b',
    surfaceHover: '#27272a',
    border: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    success: '#86efac',
    successSoft: '#052e16',
    warning: '#fcd34d',
    warningSoft: '#451a03',
    danger: '#fca5a5',
    dangerSoft: '#450a0a'
  }
}

const light = (
  primary: string,
  primaryHover: string,
  accentSoft: string,
  accentText: string
): PaletteColors => ({
  primary,
  primaryHover,
  onPrimary: '#ffffff',
  accentSoft,
  accentText
})

const dark = (
  primary: string,
  primaryHover: string,
  accentSoft: string,
  accentText: string
): PaletteColors => ({
  primary,
  primaryHover,
  onPrimary: '#0a0a0b',
  accentSoft,
  accentText
})

const PALETTE_COLORS: Record<PaletteName, Record<ColorMode, PaletteColors>> = {
  indigo: {
    light: light('#4f46e5', '#4338ca', '#eef2ff', '#3730a3'),
    dark: dark('#818cf8', '#a5b4fc', '#1e1b4b', '#c7d2fe')
  },
  ocean: {
    light: light('#0369a1', '#075985', '#f0f9ff', '#075985'),
    dark: dark('#38bdf8', '#7dd3fc', '#082f49', '#bae6fd')
  },
  forest: {
    light: light('#15803d', '#166534', '#f0fdf4', '#166534'),
    dark: dark('#4ade80', '#86efac', '#052e16', '#bbf7d0')
  },
  sunset: {
    light: light('#c2410c', '#9a3412', '#fff7ed', '#9a3412'),
    dark: dark('#fb923c', '#fdba74', '#431407', '#fed7aa')
  },
  rose: {
    light: light('#be123c', '#9f1239', '#fff1f2', '#9f1239'),
    dark: dark('#fb7185', '#fda4af', '#4c0519', '#fecdd3')
  },
  violet: {
    light: light('#7c3aed', '#6d28d9', '#f5f3ff', '#5b21b6'),
    dark: dark('#a78bfa', '#c4b5fd', '#2e1065', '#ddd6fe')
  },
  amber: {
    light: light('#b45309', '#92400e', '#fffbeb', '#92400e'),
    dark: dark('#fbbf24', '#fcd34d', '#451a03', '#fde68a')
  },
  slate: {
    light: light('#334155', '#1e293b', '#f8fafc', '#1e293b'),
    dark: dark('#cbd5e1', '#e2e8f0', '#0f172a', '#e2e8f0')
  },
  teal: {
    light: light('#0f766e', '#115e59', '#f0fdfa', '#115e59'),
    dark: dark('#2dd4bf', '#5eead4', '#042f2e', '#99f6e4')
  },
  crimson: {
    light: light('#b91c1c', '#991b1b', '#fef2f2', '#991b1b'),
    dark: dark('#f87171', '#fca5a5', '#450a0a', '#fecaca')
  }
}

/** Three glow hues per palette: main, second, third. */
const THINKING_HUES: Record<PaletteName, [string, string, string]> = {
  indigo: ['#818cf8', '#c084fc', '#38bdf8'],
  ocean: ['#38bdf8', '#22d3ee', '#818cf8'],
  forest: ['#4aef91', '#f7e75c', '#ffa834'],
  sunset: ['#fb923c', '#facc15', '#f43f5e'],
  rose: ['#fb7185', '#f472b6', '#fb923c'],
  violet: ['#a78bfa', '#f472b6', '#60a5fa'],
  amber: ['#fbbf24', '#f97316', '#fde047'],
  slate: ['#94a3b8', '#cbd5e1', '#64748b'],
  teal: ['#2dd4bf', '#a3e635', '#38bdf8'],
  crimson: ['#f87171', '#fb923c', '#e11d48']
}

/** Shade (0 to 1) and opacity of each glow layer, per mode. */
const THINKING_LAYERS: Record<
  ColorMode,
  { main: number; deep: number; soft: number; alpha: number[] }
> = {
  dark: {
    main: 1,
    deep: 0.7,
    soft: 0.8,
    alpha: [0.35, 0.3, 0.34, 0.24, 0.3, 0.22]
  },
  light: {
    main: 0.9,
    deep: 0.57,
    soft: 0.72,
    alpha: [0.4, 0.31, 0.41, 0.3, 0.37, 0.27]
  }
}

function rgb(hex: string): number[] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16))
}

function rgba(channels: number[], shade: number, alpha: number): string {
  const [r, g, b] = channels.map((channel) => Math.round(channel * shade))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getThinkingTokens(
  palette: PaletteName,
  mode: ColorMode
): ThinkingTokens {
  const [first, second, third] = (
    THINKING_HUES[palette] ?? THINKING_HUES.indigo
  ).map(rgb)
  const { main, deep, soft, alpha } = THINKING_LAYERS[mode]
  const tint = first.map((channel) => Math.round(255 * 0.94 + channel * 0.06))

  return {
    thinking1: rgba(first, main, alpha[0]),
    thinking1Deep: rgba(first, deep, alpha[1]),
    thinking2: rgba(second, main, alpha[2]),
    thinking2Soft: rgba(second, soft, alpha[3]),
    thinking3: rgba(third, main, alpha[4]),
    thinking3Soft: rgba(third, soft, alpha[5]),
    thinkingSurface:
      mode === 'dark' ? rgba(rgb(BASE.dark.bg), 1, 0.82) : rgba(tint, 1, 0.94)
  }
}

export function isPaletteName(value: unknown): value is PaletteName {
  return (PALETTE_NAMES as readonly unknown[]).includes(value)
}

export function getThemeTokens(
  palette: PaletteName,
  mode: ColorMode
): ThemeTokens {
  const colors = PALETTE_COLORS[palette] ?? PALETTE_COLORS.indigo
  return {
    ...BASE[mode],
    ...colors[mode],
    ...getThinkingTokens(palette, mode)
  }
}

const toKebab = (value: string): string =>
  value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/** The CSS for one palette and mode, as `:host { --bac-…: … }`. */
export function buildThemeCss(
  palette: PaletteName,
  mode: ColorMode,
  selector = ':host'
): string {
  const tokens = getThemeTokens(palette, mode)
  const declarations = Object.entries(tokens)
    .map(([name, value]) => `--bac-${toKebab(name)}:${value};`)
    .join('')

  const blend = mode === 'dark' ? 'screen' : 'soft-light'

  return `${selector}{${declarations}--bac-thinking-blend:${blend};color-scheme:${mode};}`
}

function relativeLuminance(hex: string): number {
  const channels = rgb(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
