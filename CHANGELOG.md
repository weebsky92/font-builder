# Changelog

## 0.1.0-alpha.4 - 2026-09-24

### Added
- 3-step desktop flow: Add → Review → Download
- folder picker alongside file/ZIP picker
- temporary build directory managed by the desktop app
- explicit save buttons for ZIP, TTF, OTF, WOFF, WOFF2 and CSS
- safe desktop command that only exports files from Font Builder's temporary output

### Changed
- removed the redundant macOS + Windows badge from the main UI
- full-window scrolling is disabled for the normal desktop flow
- build no longer asks for a destination folder before compilation
- result screen focuses on downloads instead of filesystem paths
- desktop bundle version uses `0.1.0-4`

### Known
- Windows SmartScreen warning remains until production code signing is configured
- macOS signing/notarization is not configured yet

## 0.1.0-alpha.3 - 2026-09-24

### Added
- Polish / English UI
- language switcher with local preference persistence
- user-facing family analysis summary
- build success panel

### Changed
- raw engine JSON is no longer displayed to normal users

## 0.1.0-alpha.2 - 2026-09-22

### Added
- public GitHub repository
- MIT license
- GitHub Actions build matrix for macOS and Windows

## 0.1.0-alpha.1 - 2026-09-22

### Added
- local JSON CLI engine
- file, folder and ZIP input
- Variable Font build pipeline
