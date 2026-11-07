# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
