# Changelog

## 0.1.0-alpha.7 - 2026-09-24

### Fixed
- Polish glyph audit now survives unsupported Variable Font source outlines
- single-master fonts no longer allow a Variable Font build that is guaranteed to fail
- engine errors are unwrapped into readable desktop messages
- analysis copy no longer claims unsupported sources are ready to build

### Added
- direct static CFF OTF Glyph Lab repair
- CFF repair keeps existing CFF outlines and adds only missing glyph charstrings
- direct download of a repaired single static font
- CI coverage for CFF OTF missing-glyph detection and repair

### Known
- CFF/CFF2 source masters are still not supported for Variable Font compilation
- CFF2 Glyph Lab repair is not enabled yet
- Windows installers remain unsigned and can trigger SmartScreen

# Changelog

## 0.1.0-alpha.6 - 2026-09-24

### Added
- Polish Glyph Lab for 18 uppercase/lowercase Polish characters
- glyph coverage audit across masters
- SVG outline preview
- automatic repair recipes
- component-based acute / dot / ogonek construction
- geometric fallback marks when a component is missing
- dedicated Ł / ł stroke generation
- manual X / Y / scale / rotation controls
- stroke thickness and generated-mark size controls
- non-destructive repaired-master workflow before Variable Font build

### Fixed
- Windows Nuitka engine sidecar is built with console mode disabled
- analyze/build operations should no longer open a black console window

### Known
- Glyph Lab currently supports TrueType glyf sources
- partial families with differing legacy glyph names can still require glyph-set normalization
- Windows installers remain unsigned and can trigger SmartScreen

## 0.1.0-alpha.5 - 2026-09-24

### Added
- settings modal
- tray support
- autostart
- temp cleanup setting
- configurable build mode

### Fixed
- main Windows desktop app no longer opens a console window
