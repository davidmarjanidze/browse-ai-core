// Stands in for the real element in wrapper tests. Records the properties
// the wrappers set.
class BrowseAiCoreStub extends HTMLElement {
  config: unknown = undefined
  theme: unknown = undefined
  palette: unknown = undefined
  position: unknown = undefined
  mode: unknown = undefined
  open = false
}

if (!customElements.get('browse-ai-core')) {
  customElements.define('browse-ai-core', BrowseAiCoreStub)
}
