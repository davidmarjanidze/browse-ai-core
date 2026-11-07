import {
  EnvironmentProviders,
  Injectable,
  InjectionToken,
  Signal,
  computed,
  inject,
  makeEnvironmentProviders,
  signal
} from '@angular/core'
import { BrowseAiCoreConfig, resolveConfig } from 'browse-ai-core'

/** App-wide defaults for every `<browse-ai-core>` in the app. */
export const BROWSE_AI_CORE_CONFIG = new InjectionToken<BrowseAiCoreConfig>(
  'BROWSE_AI_CORE_CONFIG'
)

/**
 * Sets defaults for all chat components in the app. The component's own
 * `config` input is merged on top.
 */
export function provideBrowseAiCore(
  config: BrowseAiCoreConfig
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: BROWSE_AI_CORE_CONFIG, useValue: config }
  ])
}

@Injectable()
export class ConfigStore {
  readonly #appConfig = inject(BROWSE_AI_CORE_CONFIG, { optional: true })
  readonly #source = signal<Signal<BrowseAiCoreConfig> | null>(null)

  readonly config = computed(() =>
    resolveConfig(this.#appConfig ?? undefined, this.#source()?.())
  )
  readonly strings = computed(() => this.config().strings)
  readonly features = computed(() => this.config().features)

  /** Called once by the root component with its inputs. */
  connect(source: Signal<BrowseAiCoreConfig>): void {
    this.#source.set(source)
  }
}
