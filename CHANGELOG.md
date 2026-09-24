# Changelog

## 0.1.0-alpha.5 - 2026-09-24

### Added
- settings gear and settings modal
- persistent desktop settings stored locally
- close-to-tray option
- native tray menu with Show / Quit
- launch-at-startup option
- clean temporary output on launch option
- configurable default build mode

### Changed
- Windows release app uses GUI subsystem, removing the extra console window
- desktop bundle version uses `0.1.0-5`

### Planned
- `alpha.6`: Glyph Lab for auditing and repairing missing Polish glyphs before build

### Known
- unsigned Windows installers can still trigger SmartScreen
- macOS signing/notarization is not configured yet

## 0.1.0-alpha.4 - 2026-09-24

### Added
- 3-step desktop flow: Add → Review → Download
- temporary build directory and per-format save actions
