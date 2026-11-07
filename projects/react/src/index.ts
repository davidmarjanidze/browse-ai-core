'use client'
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'
import 'browse-ai-core/element'
import type {
  BrowseAiCoreConfig,
  BrowseAiCoreElement,
  ChatMode,
  ChatPosition,
  MessageSentEvent,
  PaletteName,
  ResponseReceivedEvent,
  ThemeChangeEvent,
  ThemeMode
} from 'browse-ai-core'

export interface BrowseAiCoreProps {
  config?: BrowseAiCoreConfig
  theme?: ThemeMode
  palette?: PaletteName
  position?: ChatPosition
  mode?: ChatMode
  /** Controls the panel. Leave it out to let the chat manage it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onOpened?: () => void
  onClosed?: () => void
  onMessageSent?: (event: MessageSentEvent) => void
  onResponseReceived?: (event: ResponseReceivedEvent) => void
  onError?: (error: Error) => void
  onThemeChange?: (event: ThemeChangeEvent) => void
  className?: string
  style?: CSSProperties
  /** Elements with a `slot` attribute: launcher-icon, header, empty-state, footer. */
  children?: ReactNode
  ref?: Ref<BrowseAiCoreElement>
}

const EVENTS = {
  openChange: 'onOpenChange',
  opened: 'onOpened',
  closed: 'onClosed',
  messageSent: 'onMessageSent',
  responseReceived: 'onResponseReceived',
  errorOccurred: 'onError',
  themeChange: 'onThemeChange'
} as const satisfies Record<string, keyof BrowseAiCoreProps>

type Handler = (detail: unknown) => void

/** The chat assistant as a React component. */
export function BrowseAiCore(props: BrowseAiCoreProps): ReactElement {
  const {
    config,
    theme,
    palette,
    position,
    mode,
    open,
    className,
    style,
    children,
    ref
  } = props
  const element = useRef<BrowseAiCoreElement | null>(null)
  const latestProps = useRef(props)
  latestProps.current = props

  const setRef = useCallback(
    (node: BrowseAiCoreElement | null) => {
      element.current = node
      if (typeof ref === 'function') return ref(node)
      if (ref) ref.current = node
      return undefined
    },
    [ref]
  )

  useEffect(() => {
    const node = element.current
    if (!node) return
    node.config = config ?? {}
    node.theme = theme
    node.palette = palette
    node.position = position
    node.mode = mode
    if (open !== undefined) node.open = open
  }, [config, theme, palette, position, mode, open])

  useEffect(() => {
    const node = element.current
    if (!node) return
    const listeners = Object.entries(EVENTS).map(([type, prop]) => {
      const listener = (event: Event): void => {
        const handler = latestProps.current[prop] as Handler | undefined
        handler?.((event as CustomEvent).detail)
      }
      node.addEventListener(type, listener)
      return () => node.removeEventListener(type, listener)
    })
    return () => listeners.forEach((remove) => remove())
  }, [])

  return createElement(
    'browse-ai-core',
    { ref: setRef, className, style },
    children
  )
}

export type {
  BrowseAiCoreConfig,
  BrowseAiCoreElement,
  ChatMode,
  ChatPosition,
  MessageSentEvent,
  PaletteName,
  ResponseReceivedEvent,
  ThemeChangeEvent,
  ThemeMode
} from 'browse-ai-core'
