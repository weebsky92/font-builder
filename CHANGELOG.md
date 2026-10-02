# Changelog

## 0.1.0-alpha.12 - 2026-10-02

### Branding
- Font Builder is now vvFont
- added vv/W ecosystem monogram and "by WEEBSKY" lockup
- desktop product title updated to vvFont Alpha

### Added
- Auto / Dark / Light appearance modes
- live operating-system theme detection in Auto mode
- compact language dropdown with PL / EN locale markers
- persisted appearance preference

### UX polish
- larger readable secondary typography
- unified app surfaces, borders, radii, shadows and spacing
- refined process rail
- stronger Font Tools / Glyph Lab workspace treatment
- improved loading overlay hierarchy
- clearer export cards
- dedicated light-theme token set

### Localization
- Polish-facing Font Tools labels are localized where natural
- PL and EN remain separate translation dictionaries

## 0.1.0-alpha.11.3 - 2026-10-01

### Added
- direct drag positioning of Glyph Lab marks in the SVG preview
- live synchronization between drag position and X / Y sliders
- Shift + drag axis constraint
- grab / grabbing cursor states and subtle hover feedback

### Preserved
- sliders remain available for precise positioning
- Reset AUTO behavior
- independent Roman / Italic recipes
- family-wide normalized recipe propagation

### QA
- desktop build/CI verifies the updated frontend compiles on Windows and macOS
- existing Roman / Italic and real Averia regressions remain enabled

## 0.1.0-alpha.11.2 - 2026-09-29

### Changed
- Glyph Lab corrections are split into independent Roman and Italic profiles
- Roman edits propagate only across Roman weights
- Italic edits propagate only across Italic weights
- Glyph Lab preview can explicitly target Roman or Italic masters

### Added
- Roman / Italic switch in Glyph Lab
- regression test proving different geometry deltas are preserved between Roman and Italic repairs
- audit metadata describing which geometry profiles are available

### Fixed
- Character Map hides Show more when the complete filtered result is already visible
- inactive Font Tools navigation labels have better contrast

## 0.1.0-alpha.11.1 - 2026-09-28

### Fixed
- Character Map now renders glyph samples with the currently selected real font variant
- Test Drive disables browser/WebView spelling and autocorrect decoration
- Health Check no longer exposes raw issue codes as primary labels
- Health summary now counts informational findings separately

### Added
- optional metadata name autosync: Family + Style -> Full Name + PostScript Name
- generated whole-family `fonts.css` with @font-face declarations
- CSS is included in the Webfont ZIP and can also be saved individually
- regression assertions for generated CSS

## 0.1.0-alpha.11 - 2026-09-28

### Added
- Font Tools workspace available after analysis
- live Test Drive using the actual selected font
- searchable Unicode Character Map
- family and per-variant Health Check
- non-destructive Metadata Editor
- whole-family WOFF / WOFF2 converter
- ZIP export for converted webfonts
- safe desktop command for reading preview font bytes only from Font Builder temp output
- engine tests for Font Tools inspection, metadata editing and conversion

### Changed
- analysis action bar now exposes Font Tools as a first-class workflow
- project scope now covers general font inspection and preparation tools in addition to Variable Font build and Glyph Lab

### Known
- Axis Manager, static instance generation, subset builder and family batch rename remain planned for the next font-tools pass
- Windows installers remain unsigned and may trigger SmartScreen
- macOS signing/notarization is not configured yet

## 0.1.0-alpha.10 - 2026-09-27

### Added
- family-wide Glyph Lab recipes
- normalized recipe deltas relative to each master's own AUTO placement
- repaired-family ZIP export
- compact selector for downloading repaired variants individually
- real Averia regression requiring all 6 masters to be repaired and re-audited to 18/18

### Changed
- repaired masters, not the repair directory, become the active input for the next analysis/build
- avoids re-ingesting the generated ZIP alongside repaired source masters

### Expected workflow
- edit once on the representative master
- apply to every family variant
- download the whole repaired family or a selected variant
- continue directly to Variable Font build

## 0.1.0-alpha.9 - 2026-09-27

### Fixed
- Windows Polish-glyph audit no longer fails on CP1252 when returning characters such as Ą / Ć / Ę
- legacy `OS/2.usMaxContext` is hydrated before FontTools `addFeatureVariations()`
- historical `usMaxContex` spelling is used as a fallback when present

### Verified
- real 6-master Averia Serif Libre family downloaded from Google Fonts in CI
- real Averia Polish-glyph audit passes on Windows and macOS
- real Averia Variable Font build passes on Windows and macOS
- compiled Nuitka sidecar passes the same Averia audit + build regression on Windows and macOS


## 0.1.0-alpha.8 - 2026-09-27

### Changed
- analysis now separates font count, Polish glyph coverage and Variable Font availability
- analysis actions are Back / Draw Polish glyphs / Build Variable Font
- action availability follows the actual input state
- selecting a new set after Back replaces the previous analyzed job
- multiple font families are no longer silently reduced to the first family
- package, engine and desktop bundle versions are synchronized again

### Fixed
- legacy OS/2 tables missing `usMaxContext` no longer crash saves/builds
- shared pre-save compatibility is used by Glyph Lab, Variable builds and OTF conversion
- repaired static-font download no longer expects a result-page status element
- glyph-audit failures are retained as an explicit analysis state instead of disappearing silently

### Tests
- regression test for an OS/2 v2 object missing `usMaxContext`
- existing TrueType and CFF Glyph Lab repair tests remain enabled

### Known
- CFF/CFF2 masters are still not Variable Font sources
- CFF2 Glyph Lab repair is not enabled yet
- Windows installers remain unsigned and may trigger SmartScreen

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
