# Font Builder - Project

Version: `0.1.0-alpha.5`
License: MIT
Repository: `weebsky92/font-builder`

## Scope

Local cross-platform app and reusable engine for analyzing static font families and building Variable Font packages.

Targets:
- macOS
- Windows

Font processing is local. Runtime AI is not required.

## Current desktop flow

1. Add font files, a folder or ZIP.
2. Review detected family and build mode.
3. Build to an isolated temporary directory.
4. Save ZIP or individual TTF / OTF / WOFF / WOFF2 / CSS files.

## Settings

Alpha 5 adds persistent local desktop settings:
- close to tray instead of quitting
- launch at system startup
- clean temporary Font Builder output on launch
- default build mode: AUTO / true-variable / discrete-variable

The settings file lives in the application config directory and contains no secrets.

## Tray

A native tray menu is available on desktop:
- Show Font Builder
- Quit

If `close_to_tray` is enabled, clicking the window close button hides the app instead of terminating it.

## Windows polish

Release builds use the Windows GUI subsystem, so the additional console window is not shown.

## Glyph Lab - next milestone

Planned for `0.1.0-alpha.6`.

Goal: repair missing Polish glyphs before the Variable Font build.

Initial Polish audit:
- Ą Ć Ę Ł Ń Ó Ś Ź Ż
- ą ć ę ł ń ó ś ź ż

Planned workflow:
1. audit glyph coverage across all masters
2. show missing glyphs
3. auto-build glyphs when base letter + suitable mark/component exists
4. visual component editor for positioning/scaling accents, ogoneks, dots and strokes
5. preview before applying
6. write the repaired glyphs to every relevant static master
7. continue through the normal Variable Font build

This is intentionally a repair-focused Glyph Lab, not a general-purpose font editor.

## Current limitations

- Variable builds currently require TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but source-master variable compilation is not enabled yet.
- Discrete builds currently require the same glyph set across masters.
- Windows installers are unsigned and can trigger Microsoft Defender SmartScreen.
- macOS signing/notarization is not configured yet.
