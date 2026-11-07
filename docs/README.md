# browse-ai-core docs

`browse-ai-core` is an npm package with an AI chat assistant for web pages. It
works in Angular, React, Vue and plain HTML. By default it uses Chrome's
built-in model (Gemini Nano through the Prompt API).

The [README](../README.md) is the user guide: installation, usage in each
framework, options, styling and events. These docs are for working on the
package.

| File                               | What it covers                                       |
| ---------------------------------- | ---------------------------------------------------- |
| [architecture.md](architecture.md) | Workspace, entry points, services, styling, adapters |
| [features.md](features.md)         | Every feature, its option and where its code lives   |
| [decisions.md](decisions.md)       | Architecture decisions and why they were made        |
| [development.md](development.md)   | Setup, commands, tests, demo and examples            |
| [release.md](release.md)           | Versioning and publishing to npm                     |
| [CHANGELOG.md](../CHANGELOG.md)    | What changed in each version                         |

The BrowseAI Chrome extension uses this package. Its docs are in the
[browse-ai repo](https://github.com/davidmarjanidze/browse-ai/tree/main/docs).
