# Release

## Version

The published version is in `projects/browse-ai-core/package.json`. The
workspace `package.json` at the root is private and stays at `0.0.0`.

Use semantic versioning:

- Patch (`0.1.x`): fixes and style changes that don't change options or
  events.
- Minor (`0.x.0`): new options, features, strings, tokens or events.
- Major: removed or renamed options, events, CSS variables, parts or exports.

While the version is `0.x`, a minor release may also contain breaking changes.
Say so in the commit message.

## Publish to npm

1. Commit the changes. Move the `Unreleased` entries in `CHANGELOG.md` under
   the new version and date. Then bump the version in
   `projects/browse-ai-core/package.json` and commit that as
   `chore: release <version>`.
2. Log in to npm or provide a token. `.npmrc.example` shows the format; never
   commit a token.
3. Run:

   ```console
   npm run npm-publish
   ```

   It runs the tests, builds `dist/browse-ai-core`, smoke-tests the element
   bundle, then publishes `dist/browse-ai-core`. The README and LICENSE are
   copied into `dist` by the build, so the npm page shows the current README.

4. Wait until the version can be installed. This can take a few minutes:

   ```console
   npm view browse-ai-core@<version> version
   ```

5. Optionally build the examples against the published version:

   ```console
   node scripts/examples.mjs browse-ai-core@<version> ../examples-build
   ```

## After publishing

- Update the BrowseAI extension: `npm install browse-ai-core@^<version>` in
  the browse-ai repo, run its tests and build, and commit the update.
- The CDN URL in the README uses `browse-ai-core@0.2`, so jsDelivr serves the
  newest `0.2.x` without a README change. Update it when the minor version
  changes.
- Push the commits.

## What's in the package

`dist/browse-ai-core` contains:

- `fesm2022/` and `types/` for `browse-ai-core` and `browse-ai-core/angular`.
- `element/browse-ai-core.js`, the custom element bundle.
- `react/` and `vue/`, the wrappers.
- `package.json` with the `exports` map, `README.md` and `LICENSE` (MIT).
