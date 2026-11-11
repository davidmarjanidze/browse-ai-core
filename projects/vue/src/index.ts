import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watchEffect,
  type PropType
} from 'vue'
import 'browse-ai-core/element'
import type {
  AgentFinishedEvent,
  AgentStepEvent,
  BrowseAiCoreConfig,
  BrowseAiCoreElement,
  ChatMode,
  ChatPosition,
  MessageSentEvent,
  PaletteName,
  ResponseReceivedEvent,
  ThemeChangeEvent,
  ThemeMode,
  WatchMatchedEvent
} from 'browse-ai-core'

const EVENTS = {
  openChange: 'update:open',
  opened: 'opened',
  closed: 'closed',
  messageSent: 'messageSent',
  responseReceived: 'responseReceived',
  errorOccurred: 'error',
  themeChange: 'themeChange',
  agentStep: 'agentStep',
  agentFinished: 'agentFinished',
  watchMatched: 'watchMatched'
} as const

/** The chat assistant as a Vue 3 component. Supports `v-model:open`. */
export const BrowseAiCore = defineComponent({
  name: 'BrowseAiCore',
  props: {
    config: {
      type: Object as PropType<BrowseAiCoreConfig>,
      default: undefined
    },
    theme: { type: String as PropType<ThemeMode>, default: undefined },
    palette: { type: String as PropType<PaletteName>, default: undefined },
    position: { type: String as PropType<ChatPosition>, default: undefined },
    mode: { type: String as PropType<ChatMode>, default: undefined },
    open: { type: Boolean, default: undefined }
  },
  emits: {
    'update:open': (_open: boolean) => true,
    opened: () => true,
    closed: () => true,
    messageSent: (_event: MessageSentEvent) => true,
    responseReceived: (_event: ResponseReceivedEvent) => true,
    error: (_error: Error) => true,
    themeChange: (_event: ThemeChangeEvent) => true,
    agentStep: (_event: AgentStepEvent) => true,
    agentFinished: (_event: AgentFinishedEvent) => true,
    watchMatched: (_event: WatchMatchedEvent) => true
  },
  setup(props, { emit, slots, expose }) {
    const element = shallowRef<BrowseAiCoreElement | null>(null)
    const removers: (() => void)[] = []

    watchEffect(
      () => {
        const node = element.value
        if (!node) return
        node.config = props.config ?? {}
        node.theme = props.theme
        node.palette = props.palette
        node.position = props.position
        node.mode = props.mode
        if (props.open !== undefined) node.open = props.open
      },
      { flush: 'post' }
    )

    onMounted(() => {
      const node = element.value
      if (!node) return
      for (const [type, name] of Object.entries(EVENTS)) {
        const listener = (event: Event): void =>
          (emit as (name: string, detail: unknown) => void)(
            name,
            (event as CustomEvent).detail
          )
        node.addEventListener(type, listener)
        removers.push(() => node.removeEventListener(type, listener))
      }
    })
    onBeforeUnmount(() => removers.splice(0).forEach((remove) => remove()))

    expose({ element })
    return () => h('browse-ai-core', { ref: element }, slots['default']?.())
  }
})

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
