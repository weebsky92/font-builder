# Changelog

## 0.1.0-alpha.3 - 2026-09-24

### Added
- Polish / English UI
- language switcher with local preference persistence
- user-facing family analysis summary
- variant, weight, range, Roman and Italic metrics
- friendly explanation of smooth vs discrete build mode
- build success panel with generated formats and ZIP path
- loading and error states

### Changed
- raw engine JSON is no longer displayed to normal users
- section `Analiza / build` renamed to a simpler status view
- desktop UI version marker updated to alpha 3
- internal Tauri/Cargo bundle version uses `0.1.0-3` for MSI compatibility

### Verified before alpha 3
- Windows 11 install, launch, analyze and build all work
- macOS and Windows GitHub Actions builds pass

### Known
- Windows SmartScreen can warn because development installers are unsigned
- macOS production signing/notarization is not configured yet

## 0.1.0-alpha.2 - 2026-09-22

### Added
- public GitHub repository
- MIT license
- reusable Nuitka sidecar launcher
- GitHub Actions build matrix for macOS and Windows
- Python engine tests in CI
- generated desktop icon set for Tauri bundles

### Changed
- engine and public project checkpoint remain `0.1.0-alpha.2`
- Tauri/Cargo desktop package version uses `0.1.0-2` internally because MSI prerelease identifiers must be numeric
- public README simplified
- project notes renamed to `PROJECT.md`
- CI uses `npm install`, so the first build does not require a committed lockfile

### Fixed
- sidecar packaging now starts from a top-level launcher instead of compiling the package `__main__.py` directly
- desktop frontend no longer uses unsupported top-level await for the configured macOS target
- Tauri icon assets are generated before desktop bundling
- Windows MSI bundling uses an MSI-compatible prerelease version

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
