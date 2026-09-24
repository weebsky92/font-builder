# Font Builder - Project

Version: `0.1.0-alpha.4`
License: MIT
Repository: `weebsky92/font-builder`

## Scope

Local cross-platform app and reusable engine for analyzing static font families and building Variable Font packages.

Targets:
- macOS
- Windows

Font processing is local. Runtime AI is not required.

## Input

- individual font files
- multiple font files
- directories
- ZIP archives
- nested ZIP archives within configured safety limits

Recognized font containers:
- TTF
- OTF
- WOFF
- WOFF2

README, license files, system metadata, images and unsupported documents are ignored automatically.

## Build modes

`TRUE VARIABLE` is used when masters are interpolation-compatible.

`DISCRETE VARIABLE` preserves the supplied source outlines and switches between masters with OpenType FeatureVariations when topology differs.

`AUTO` selects the safest available mode.

## Output

- Variable TTF
- CFF OTF
- WOFF
- WOFF2
- CSS
- JSON build report
- ZIP package

## Architecture

`engine/` contains the reusable Python + FontTools engine and JSON CLI.

`desktop/` contains the Tauri 2 shell for macOS and Windows.

The engine does not depend on the desktop UI so it can be reused by another application later.

## Desktop flow

Alpha 4 uses a three-step flow:

1. Add fonts / folder / ZIP.
2. Review detected family and build mode.
3. Download the generated package or individual formats.

The desktop app no longer asks for an output folder before building. Output is created inside an isolated Font Builder temporary directory. The user explicitly chooses where to save ZIP / TTF / OTF / WOFF / WOFF2 / CSS afterwards.

## Localization

Desktop UI languages:
- Polish
- English

Language selection is stored locally.

## Verified

Windows 11 alpha 3:
- installer launches
- desktop app opens
- family analysis works
- Barlow Condensed build completes
- output package is valid

GitHub Actions alpha 3:
- macOS build passes
- Windows build passes
- source package passes

## Current limitations

- Variable builds currently require TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but source-master variable compilation is not enabled yet.
- Discrete builds currently require the same glyph set across masters.
- Production Windows code signing is not configured, so SmartScreen may warn on downloaded installers.
- Apple signing/notarization is not configured yet.

## Next checkpoint

`0.1.0-alpha.5`

- runtime test of alpha 4 multi-step flow
- final application icon
- code signing / SmartScreen plan
- differing glyph-set normalization
