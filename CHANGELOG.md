# Changelog

## [1.0.0](https://github.com/wolfsblu/cooklang-web/releases/tag/v1.0.0) (2026-11-16)

First tagged release. cooklang-web is now versioned with SemVer and published
as a container image.

### Features

- Browsable, searchable Cooklang recipe library with subdirectories, filters,
  and a cook mode that walks through the steps and runs timers.
- Recipe editor with syntax highlighting, live preview, parser diagnostics,
  undo/redo, and ingredient and cookware autocomplete.
- AI recipe import from a URL using any OpenAI-compatible chat endpoint.
- Combined shopping lists grouped by supermarket aisle, with pantry contents
  deducted automatically.
- Aisle and pantry editing from the UI.
- Image pipeline with imgproxy behind a caching Caddy.

### Deployment

- Container images are published to `ghcr.io/wolfsblu/cooklang-web`.
- Pin a release with `COOKLANG_WEB_VERSION`; `/health` reports the running
  version, commit, and Cook CLI version.
