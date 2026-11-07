import { act, cleanup, render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import type { BrowseAiCoreElement } from 'browse-ai-core'
import { BrowseAiCore } from './index'

describe('React BrowseAiCore', () => {
  afterEach(cleanup)

  it('renders the element and sets its properties', () => {
    const ref = createRef<BrowseAiCoreElement>()
    const config = { strings: { title: 'Help' } }
    render(
      createElement(BrowseAiCore, {
        ref,
        config,
        theme: 'dark',
        palette: 'rose',
        mode: 'inline',
        open: true,
        className: 'chat'
      })
    )
    const element = ref.current!
    expect(element.tagName).toBe('BROWSE-AI-CORE')
    expect(element.config).toBe(config)
    expect(element.theme).toBe('dark')
    expect(element.palette).toBe('rose')
    expect(element.mode).toBe('inline')
    expect(element.open).toBe(true)
    expect(element.className).toBe('chat')
  })

  it('calls event props with the event detail', () => {
    const onMessageSent = vi.fn()
    const onOpenChange = vi.fn()
    const onError = vi.fn()
    const { container } = render(
      createElement(BrowseAiCore, { onMessageSent, onOpenChange, onError })
    )
    const element = container.querySelector('browse-ai-core')!
    act(() => {
      element.dispatchEvent(
        new CustomEvent('messageSent', { detail: { text: 'Hi' } })
      )
      element.dispatchEvent(new CustomEvent('openChange', { detail: true }))
      element.dispatchEvent(
        new CustomEvent('errorOccurred', { detail: new Error('x') })
      )
    })
    expect(onMessageSent).toHaveBeenCalledWith({ text: 'Hi' })
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('renders slot children', () => {
    const { container } = render(
      createElement(
        BrowseAiCore,
        null,
        createElement('p', { slot: 'empty-state' }, 'Hello')
      )
    )
    expect(
      container.querySelector('browse-ai-core [slot="empty-state"]')
        ?.textContent
    ).toBe('Hello')
  })
})
