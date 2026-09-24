# Font Builder - Project

Version: `0.1.0-alpha.6`
License: MIT
Repository: `weebsky92/font-builder`

## Scope

Local cross-platform app and reusable engine for analyzing static font families, repairing selected glyph coverage and building Variable Font packages.

Targets:
- macOS
- Windows

Font processing is local. Runtime AI is not required.

## Current desktop flow

1. Add font files, a folder or ZIP.
2. Review detected family, build mode and Polish glyph coverage.
3. Optionally open Glyph Lab and repair missing Polish glyphs.
4. Build to an isolated temporary directory.
5. Save ZIP or individual TTF / OTF / WOFF / WOFF2 / CSS files.

## Glyph Lab

Alpha 6 adds a repair-focused Glyph Lab for:

- Ą Ć Ę Ł Ń Ó Ś Ź Ż
- ą ć ę ł ń ó ś ź ż

Features:
- coverage audit across all static masters
- present / missing / partial state
- preview from a representative Roman master
- automatic recipe generation
- component reuse when acute / dot / ogonek exists in the font
- geometric fallback when an accent component is missing
- dedicated Ł / ł stroke generator
- manual X / Y / scale / rotation adjustment
- stroke thickness adjustment
- geometry width / height adjustment
- non-destructive repair into Font Builder temporary output
- re-analysis after repair before Variable Font build

The original font files are never overwritten.

## Settings

Persistent local desktop settings:
- close to tray instead of quitting
- launch at system startup
- clean temporary output on launch
- default build mode: AUTO / true-variable / discrete-variable

## Windows polish

- main desktop executable uses Windows GUI subsystem
- Nuitka font engine sidecar is built with Windows console disabled
- analyze / build / Glyph Lab operations must not open console windows

## Current limitations

- Variable builds currently require TrueType `glyf` source masters.
- Glyph Lab repair currently targets TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but source-master Variable/Glyph Lab compilation is not enabled yet.
- Discrete builds still require a compatible glyph set after repair; further normalization is planned for unusual partial-master families.
- Windows installers are unsigned and can trigger Microsoft Defender SmartScreen.
- macOS signing/notarization is not configured yet.

## Next checkpoint

`0.1.0-alpha.7`

Primary:
- real Windows runtime test of silent sidecar + Glyph Lab
- verify generated Polish glyphs across multiple real font families

Later:
- optional point-level contour editor if component/geometry controls are not enough
- glyph-set normalization for partial families
- code signing / notarization
