# Font Builder - Project

Version: `0.1.0-alpha.2`
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

## Current limitations

- Variable builds currently require TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but variable compilation from CFF/CFF2 source masters is not enabled yet.
- Discrete builds currently require the same glyph set across masters.
- Production code signing and Apple notarization are not configured yet.

## Verified test

The engine has been tested end-to-end with an 18-master Barlow Condensed ZIP containing Roman and Italic weights 100-900 plus ignored metadata files.

The test produced and reopened TTF, CFF OTF, WOFF and WOFF2 outputs successfully.

## Next checkpoint

`0.1.0-alpha.3`

- first GitHub Actions build on macOS and Windows
- fix platform-specific sidecar or packaging issues if CI finds any
- start PL/EN UI localization layer
