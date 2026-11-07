# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.4.2] - 2026-11-07

### Changed

- README: the intro lists the tool groups; new parts `tool-card`, `mic-button` and `selection-actions`; the grouped Tools select and how to translate tool steps and group headings. `docs/features.md` covers the new tools, voice input and notes.

## [0.4.1] - 2026-11-07

### Changed

- Links to the BrowseAI extension point to the `browse-ai-web-extension` repo.

## [0.4.0] - 2026-11-07

### Changed

- The round launcher button is 50% see-through and fades to fully opaque on hover or keyboard focus. Change it with `--bac-launcher-opacity`.

### Fixed

- Notes, research key points and review lists no longer show `<note>` and similar tags the model sometimes adds. Notes already saved with tags show without them.
- Argument Mapper and Performance Explainer cards use the chat panel's width for their columns, not the window's. "Points for" no longer takes a quarter of the card on wide screens.

## [0.3.0] - 2026-11-07

### Added

- Link Inspector, Reply Drafter, Review Summarizer, Research Notes, Argument Mapper, Form Validator, Dictation, Performance Explainer, Scam Check and Dark Pattern Detector tools. Each has a feature flag and a "How to use" box.
- Notes: a "Save note" action on selected text, a Notes tool for the whole page, highlights on revisit, and a Notes panel in the header menu (websites, then pages, then notes).
- Mic button in the composer (`voiceInput`).
- The tool picker groups tools under headings: Forms, Read & understand, Write, Save & extract, Safety and Developer. `SelectOption` takes an optional `group`.
- Performance Explainer shows live charts of main thread time, interactions, layout shifts and memory.

### Changed

- Tool names are title case, e.g. "Subject Finder".
- CDN URLs in the README use `browse-ai-core@0.2`.

## [0.2.0] - 2026-11-07

### Added

- `defaultContextMode` config option for where the "Page / General" switch starts.
- Summarizer, Translator, Writer, Rewriter and Proofreader tools on Chrome's task APIs, with per-model download, a Translator language picker and `ai.builtInTools` options.
- Summarize, Translate and other actions on selected page text, with a switch in settings.
- Image Downloader tool: finds images on the screen by subject and downloads them as a zip.
- Subject Finder tool: finds the part of the page the user describes and scrolls to it.
- `isAiSupported()`, `getAiAvailability()` and `getSessionOptions()` in the core entry.

### Changed

- The chat shows "not supported" also when the model's availability check fails.
- While a response or tool runs, only Stop is enabled in the composer.
- `bac-model-download` takes inputs, so it serves the main model and the tool models.
