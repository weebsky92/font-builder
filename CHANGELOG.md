# Changelog

## 0.1.0-alpha.2 — 2026-09-22

### Added
- public GitHub repository bootstrap
- MIT license
- bilingual README: English + Polish
- Nuitka sidecar launcher independent from package-relative execution
- GitHub Actions macOS + Windows desktop build pipeline
- engine test step in CI

### Changed
- CI uses `npm install`, so the first public build does not depend on a pre-generated `package-lock.json`
- desktop, engine and package version bumped to `0.1.0-alpha.2`

### Fixed
- sidecar build no longer compiles `fontbuilder_engine/__main__.py` as a standalone script with an invalid relative-import context

## 0.1.0-alpha.1 — 2026-09-22

### Added
- reusable local engine with JSON CLI
- file/folder/ZIP ingestion
- nested ZIP support
- safe unzip protection
- automatic README/LICENSE/system-file ignoring
- TTF/OTF/WOFF/WOFF2 recognition
- family/style/weight/italic analysis
- canonical named-weight normalization
- glyph topology audit
- AUTO true/discrete variable selection
- discrete variable builder using FeatureVariations
- true-variable varLib path for compatible masters
- TTF export
- real CFF OTF export
- WOFF export
- WOFF2 export
- CSS export
- JSON build report
- output ZIP packaging
- Tauri macOS/Windows desktop shell scaffold

### Verified
- full Barlow Condensed 18-master ZIP test
