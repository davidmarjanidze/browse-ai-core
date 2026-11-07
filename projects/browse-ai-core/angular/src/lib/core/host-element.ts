import { ElementRef, InjectionToken, Provider, inject } from '@angular/core'

/** The root `<browse-ai-core>` element. */
export const BAC_HOST_ELEMENT = new InjectionToken<HTMLElement>(
  'BAC_HOST_ELEMENT'
)

export const provideHostElement = (): Provider => ({
  provide: BAC_HOST_ELEMENT,
  useFactory: () => inject(ElementRef<HTMLElement>).nativeElement
})

/** True when `target` is the chat element or inside it. */
export function isInsideHost(host: HTMLElement, event: Event): boolean {
  return event.composedPath().includes(host)
}
