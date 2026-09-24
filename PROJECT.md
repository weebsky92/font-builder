# Font Builder - Project

Version: `0.1.0-alpha.3`
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

## UI / localization

Alpha 3 replaces the raw JSON result view with a user-facing summary:
- detected family
- number of variants
- number/range of weights
- Roman / Italic counts
- build mode
- ignored file count
- build success and output ZIP path

Desktop UI languages:
- Polish
- English

Language selection is stored locally in the app.

## Current limitations

- Variable builds currently require TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but variable compilation from CFF/CFF2 source masters is not enabled yet.
- Discrete builds currently require the same glyph set across masters.
- Production code signing and Apple notarization are not configured yet.
- Unsigned Windows installers can trigger Microsoft Defender SmartScreen. Production signing is a separate release step.

## Verified test

Windows 11:
- installer launches
- desktop app opens
- family analysis works
- Barlow Condensed build completes
- output Variable Font package is created successfully

GitHub Actions:
- macOS build passes
- Windows build passes
- source package passes

## Next checkpoint

`0.1.0-alpha.4`

- runtime test of alpha 3 UX on Windows and macOS
- replace temporary development icon with final artwork
- plan production signing / SmartScreen / notarization
- normalize differing glyph sets across masters
