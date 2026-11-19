# Changelog

## [1.2.0](https://github.com/wolfsblu/cooklang-web/compare/v1.1.0...v1.2.0) (2026-11-19)


### Features

* add a weekly meal planner ([#21](https://github.com/wolfsblu/cooklang-web/issues/21)) ([e2f4bc6](https://github.com/wolfsblu/cooklang-web/commit/e2f4bc69b2fabd71e6544285d9f055e3544108d1))

## [1.1.0](https://github.com/wolfsblu/cooklang-web/compare/v1.0.1...v1.1.0) (2026-11-17)


### Features

* add a new-recipe split button to the header ([#14](https://github.com/wolfsblu/cooklang-web/issues/14)) ([961fc5e](https://github.com/wolfsblu/cooklang-web/commit/961fc5e149c6cd23b0647ce0514c1f214346c2a2))
* add AI photo import ([#13](https://github.com/wolfsblu/cooklang-web/issues/13)) ([879f95a](https://github.com/wolfsblu/cooklang-web/commit/879f95a8163eec6a9507ebb3fa8942cbeebb70c6))
* add navigation submenus and restructure ingredients pages ([#17](https://github.com/wolfsblu/cooklang-web/issues/17)) ([2fbe2cb](https://github.com/wolfsblu/cooklang-web/commit/2fbe2cb6fb1f273cce38fa4c1530c411e9f08180))
* add settings page with theme preference ([#18](https://github.com/wolfsblu/cooklang-web/issues/18)) ([0171ed0](https://github.com/wolfsblu/cooklang-web/commit/0171ed024928b641b649c8548adf586476d97881))
* link recipe tags to the filtered recipe list ([#15](https://github.com/wolfsblu/cooklang-web/issues/15)) ([a2c584f](https://github.com/wolfsblu/cooklang-web/commit/a2c584f4ca47f0576a497a5aef8ad98ec5ecfd01))


### Bug Fixes

* lay out aisle assignment controls across the row ([#19](https://github.com/wolfsblu/cooklang-web/issues/19)) ([6b9b179](https://github.com/wolfsblu/cooklang-web/commit/6b9b179f54e994758ca5f42d7ffee0b90a080257))


### Build System

* align Node 26 across local, CI and Docker ([#11](https://github.com/wolfsblu/cooklang-web/issues/11)) ([5ec4f2d](https://github.com/wolfsblu/cooklang-web/commit/5ec4f2da09528d070c0c7be4d54c9f4a0ebdb310))

## [1.0.1](https://github.com/wolfsblu/cooklang-web/compare/v1.0.0...v1.0.1) (2026-11-16)


### Build System

* **deps:** bump node from 24-alpine to 26-alpine ([#4](https://github.com/wolfsblu/cooklang-web/issues/4)) ([b734653](https://github.com/wolfsblu/cooklang-web/commit/b7346538caba1ecd045a37422dbf8666a49be9ba))

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
