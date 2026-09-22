# Architecture — 0.1.0-alpha.2

## Boundary

This is an independent product/engine. It is **not** part of WEEBSKY OS unless a later explicit integration is approved.

## Layers

1. `fontbuilder_engine.ingest`
   - files / directories / ZIP
   - nested ZIP
   - safe extraction
   - ignore README/LICENSE/macOS metadata/unsupported files

2. `inspect`
   - OpenType name tables
   - weight / italic detection
   - family grouping
   - glyph topology audit
   - AUTO build-mode decision

3. `builder`
   - TRUE VARIABLE via FontTools varLib where master topology is compatible
   - DISCRETE VARIABLE via `fvar` + `STAT` + `GSUB FeatureVariations` where topology differs
   - preserves supplied static master outlines in discrete mode

4. `otf`
   - TTF/glyf -> genuine CFF OTF conversion
   - keeps layout and variable metadata/FeatureVariations

5. CLI JSON contract
   - `analyze`
   - `build`
   - stable boundary for desktop UI and future host applications

6. Tauri desktop shell
   - drag & drop
   - file/folder selection
   - analysis screen
   - build progress
   - open output directory

## Why no AI runtime

Font family recognition, topology checks, axis construction and exports are deterministic. AI is not required for normal operation.
