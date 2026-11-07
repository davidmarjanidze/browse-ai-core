import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import type { BrowseAiCoreElement } from 'browse-ai-core'
import { BrowseAiCore } from './index'

describe('Vue BrowseAiCore', () => {
  it('sets element properties and updates them', async () => {
    const config = { features: { bookmarks: true } }
    const wrapper = mount(BrowseAiCore, {
      props: { config, theme: 'light', palette: 'teal' },
      attachTo: document.body
    })
    const element = wrapper.element as BrowseAiCoreElement
    expect(element.tagName).toBe('BROWSE-AI-CORE')
    expect(element.config).toEqual(config)
    expect(element.palette).toBe('teal')

    await wrapper.setProps({ palette: 'amber', open: true })
    await nextTick()
    expect(element.palette).toBe('amber')
    expect(element.open).toBe(true)
    wrapper.unmount()
  })

  it('emits events, including update:open for v-model', async () => {
    const wrapper = mount(BrowseAiCore, { attachTo: document.body })
    const element = wrapper.element
    element.dispatchEvent(new CustomEvent('openChange', { detail: true }))
    element.dispatchEvent(
      new CustomEvent('responseReceived', { detail: { text: 'Hi' } })
    )
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    expect(wrapper.emitted('responseReceived')).toEqual([[{ text: 'Hi' }]])
    wrapper.unmount()
  })

  it('renders the default slot inside the element', () => {
    const wrapper = mount(BrowseAiCore, {
      slots: { default: () => h('p', { slot: 'empty-state' }, 'Hello') }
    })
    expect(wrapper.find('[slot="empty-state"]').text()).toBe('Hello')
  })
})
