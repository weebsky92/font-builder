# Changelog

## 0.1.0-alpha.2 - 2026-09-22

### Added
- public GitHub repository
- MIT license
- reusable Nuitka sidecar launcher
- GitHub Actions build matrix for macOS and Windows
- Python engine tests in CI

### Changed
- engine, desktop and Tauri versions moved to `0.1.0-alpha.2`
- public README simplified
- project notes renamed to `PROJECT.md`
- CI uses `npm install`, so the first build does not require a committed lockfile

### Fixed
- sidecar packaging now starts from a top-level launcher instead of compiling the package `__main__.py` directly

## 0.1.0-alpha.1 - 2026-09-22

### Added
- local JSON CLI engine
- file, folder and ZIP input
- nested ZIP support
- safe ZIP extraction
- irrelevant file filtering
- TTF/OTF/WOFF/WOFF2 recognition
- family and master analysis
- topology audit
- AUTO true/discrete selection
- TTF, CFF OTF, WOFF, WOFF2, CSS and ZIP output
- Tauri desktop shell scaffold
