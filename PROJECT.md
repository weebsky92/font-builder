# Font Builder - Project

Version: `0.1.0-alpha.9`
License: MIT
Repository: `weebsky92/font-builder`

## Scope

Local cross-platform desktop app and reusable engine for:
- analyzing static font families,
- auditing and repairing Polish glyph coverage,
- building Variable Font packages from compatible TrueType masters,
- exporting repaired static fonts without overwriting originals.

Targets:
- Windows
- macOS

All font processing is local. Runtime AI is not required.

## Current workflow

1. Add font files, a folder or ZIP.
2. Analyze the selected job.
3. The analysis independently reports:
   - number of font files,
   - Polish glyph coverage,
   - Variable Font availability.
4. Available actions are always explicit:
   - Back,
   - Draw Polish glyphs,
   - Build Variable Font.
5. Repair happens in Font Builder temporary output.
6. Variable builds and repaired static fonts are exported only when the user chooses where to save them.

A job is expected to contain variants of one font family. If multiple different families are detected, build and Glyph Lab actions are blocked and the user is asked to choose one family.

After returning from analysis with Back, selecting a new file/folder set replaces the previous job instead of appending to it.

## Analysis action rules

### One font, Polish glyphs missing
- Draw Polish glyphs: enabled
- Build Variable Font: disabled

### One font, Polish glyphs complete
- Draw Polish glyphs: disabled
- Build Variable Font: disabled

### Multiple masters, Polish glyphs missing
- Draw Polish glyphs: enabled
- Build Variable Font: enabled when source outlines are supported
- recommended path: repair Polish glyphs, then build Variable Font

### Multiple masters, Polish glyphs complete
- Draw Polish glyphs: disabled
- Build Variable Font: enabled when source outlines are supported

## Glyph Lab

Audited characters:
- Ą Ć Ę Ł Ń Ó Ś Ź Ż
- ą ć ę ł ń ó ś ź ż

Features:
- coverage audit across all masters,
- present / missing / partial state,
- automatic recipes,
- component reuse for acute / dot / ogonek,
- geometric fallback marks,
- dedicated Ł / ł stroke generator,
- SVG preview,
- X / Y / scale / rotation controls,
- thickness / generated-mark size controls,
- non-destructive repair.

Repair support:
- TrueType `glyf`
- static CFF OTF

CFF repair keeps existing CFF outlines and adds missing glyph charstrings without converting the whole font to TrueType.

## Variable Font

Current Variable Font source support:
- TrueType `glyf` masters

Modes:
- TRUE VARIABLE when masters are interpolation-compatible
- DISCRETE VARIABLE when topology differs but the glyph set is compatible
- AUTO chooses the safest available mode

CFF/CFF2 masters are not yet Variable Font sources.

## Legacy font safety

Alpha 8 adds a shared pre-save compatibility layer for older OpenType files.

Some legacy fonts can render correctly in Windows while exposing incomplete newer-version `OS/2` fields when modern FontTools recompiles them. Missing fields such as `usMaxContext` are hydrated only when absent. Existing values are preserved.

The compatibility layer is used by:
- Glyph Lab repair,
- discrete Variable Font output,
- true Variable Font output,
- OTF conversion.

## Settings

Persistent local desktop settings:
- close to tray,
- launch at system startup,
- clean temporary output on launch,
- default build mode.

## Current limitations

- CFF/CFF2 masters are not yet supported for Variable Font compilation.
- CFF2 Glyph Lab repair is not enabled yet.
- Discrete Variable builds still require compatible glyph sets across masters.
- Windows installers are unsigned and can trigger Microsoft Defender SmartScreen.
- macOS signing/notarization is not configured yet.

## Alpha 9 verified fixes

- Windows-safe engine JSON transport no longer depends on CP1252 for Polish glyph names.
- Real Averia Serif Libre audit detects missing Polish glyphs on Windows and macOS.
- Legacy `OS/2.usMaxContext` is hydrated before `FeatureVariations` is built.
- Historical `usMaxContex` spelling found in old fonts is accepted as a fallback.
- CI now downloads the real 6-master Averia Serif Libre family and tests both the Python engine and the compiled desktop sidecar.
- The compiled Windows sidecar successfully completes Averia glyph audit and Variable Font build in CI.

## Next checkpoint

`0.1.0-alpha.10`

Primary:
- real Windows runtime test with Averia Serif Libre and Roffelia,
- verify Polish audit + repair + Variable build in one flow,
- refine Glyph Lab drawing quality based on real fonts.
