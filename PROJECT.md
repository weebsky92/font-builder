# vvFont - Project

Version: `0.1.0-alpha.12`
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

## Alpha 10 family recipes

Glyph Lab recipes now belong to the whole font family, not only the preview master.

Workflow:
- the user edits a glyph on the representative master,
- Font Builder stores the edit as a delta from that master's AUTO recipe,
- every master calculates its own AUTO placement,
- the same normalized user correction is applied on top of each master's own placement,
- Light / Bold / Italic therefore keep their own proportions instead of receiving copied absolute coordinates.

Repair output:
- every supplied master is repaired,
- all repaired masters remain available individually,
- a ZIP pack containing the complete repaired family is generated,
- the repaired master paths become the active job for the next Variable Font build.

CI verifies this behavior with the real 6-master Averia Serif Libre family and requires:
- 6 repaired outputs,
- a generated ZIP,
- Polish coverage 18/18 after repair.

## Alpha 11 Font Tools

The analysis screen now exposes a dedicated Font Tools workspace.

### Test Drive
- uses the real selected font file in the desktop WebView
- editable sample text
- live size control
- variant switcher for static family masters

### Character Map
- searchable Unicode cmap
- character, Unicode codepoint and glyph name
- incremental rendering for large fonts

### Health Check
Family-level checks:
- mixed UPM values
- duplicate weight/style slots
- different cmap coverage across masters

Variant-level checks:
- required name records
- Unicode cmap
- outline type
- basic layout tables
- basic structural warnings

### Metadata Editor
Editable on a non-destructive copy:
- Family Name
- Style
- Full Name
- PostScript Name
- Version

Static CFF metadata is synchronized where available.

### Webfont Converter
- whole-family WOFF export
- whole-family WOFF2 export
- individual output files
- ZIP pack

### Desktop safety
Font preview bytes can only be read from Font Builder's own temporary output directory.

## Alpha 11.1 polish pass

Runtime QA of Alpha 11 identified several UI refinements. Alpha 11.1 adds:
- Character Map glyphs rendered with the currently selected real font variant,
- spellcheck/autocorrect disabled in Test Drive,
- Health Check information counter and human-readable issue titles,
- optional automatic synchronization of Full Name and PostScript Name from Family + Style,
- generated `fonts.css` with @font-face declarations for the whole converted family,
- `fonts.css` included in the webfont ZIP and individual output list.

### Packaging note
The Alpha 11.1 public release remains `0.1.0-alpha.11.1`. Windows MSI requires a numeric-only prerelease identifier, so that release used internal desktop bundle version `0.1.0-111`.

## Alpha 11.2 Roman / Italic Glyph Lab profiles

Glyph Lab family recipes are now split into two independent geometry profiles:
- Roman (`ital=0`)
- Italic (`ital=1`)

A correction made for Roman masters is propagated only across Roman weights. Italic corrections are stored and propagated separately across Italic weights. Each profile still uses normalized deltas over every master's own AUTO recipe, so Light / Regular / Bold retain their own proportions inside the same profile.

The Glyph Lab UI exposes a Roman / Italic switch whenever both groups are present. Families containing only one profile keep the unavailable profile disabled.

Backward compatibility:
- pre-11.2 recipes without an explicit profile remain accepted as legacy recipes.

Additional polish:
- Font Tools inactive navigation labels have improved contrast,
- Character Map no longer shows "Show more" when all filtered results are already visible.

### Packaging note for Alpha 11.2
The public release is `0.1.0-alpha.11.2`. Windows MSI uses the numeric internal bundle version `0.1.0-112`.

## Alpha 11.3 direct manipulation in Glyph Lab

Glyph placement can now be adjusted in two equivalent ways:
- drag the purple mark directly in the SVG preview,
- use the existing X / Y sliders for precise adjustment.

Both controls edit the same `dx` / `dy` recipe values, so there is only one source of truth for placement.

Interaction:
- pointer drag updates X / Y live,
- sliders follow the dragged position,
- Shift + drag constrains movement to the dominant axis,
- hover uses a subtle highlight,
- pointer cursor changes between grab / grabbing,
- Reset AUTO continues to restore the profile-specific automatic placement.

Roman and Italic remain fully independent because drag edits the currently active profile recipe only.

### Packaging note for Alpha 11.3
The public release is `0.1.0-alpha.11.3`. Windows MSI uses the numeric internal bundle version `0.1.0-113`.

## Alpha 12 vvFont UX polish

Branding:
- product name is now `vvFont`
- `vv` is the ecosystem marker derived from WEEBSKY and designed to visually read as a compact W-like monogram
- desktop title and product bundle use vvFont naming
- repository name remains unchanged for compatibility during alpha

Appearance:
- Auto / Dark / Light theme modes
- Auto follows the operating system color scheme live
- theme choice is persisted locally
- light mode uses a dedicated surface/text/border token set instead of simple color inversion
- typography and secondary metadata sizes were increased for desktop readability
- surfaces, radii, spacing and shadows were unified across the main flow, Font Tools and Glyph Lab

Language:
- PL / EN remain fully independent translation dictionaries
- language selector is now a compact dropdown with country flag and locale code
- Polish UI uses Polish labels for user-facing Font Tools sections where natural
- language choice remains persisted locally

Desktop feel:
- new branded header and vv monogram
- navigation stepper behaves as a contained process rail
- Font Tools and Glyph Lab use the same surface system as the main workflow
- loading overlay has hierarchy and local-processing context
- export cards and metadata are more readable

### Packaging note for Alpha 12
The public release is `0.1.0-alpha.12`. Windows MSI uses numeric internal bundle version `0.1.0-120`.

## Next checkpoint

`0.1.0-alpha.12.1`

Primary:
- Windows runtime QA of Font Tools,
- Axis Manager for Variable Font settings,
- Static Instances from Variable Font,
- webfont subset builder,
- family batch rename.
