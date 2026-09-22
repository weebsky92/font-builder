# Architecture

The project has two independent layers.

## Engine

`engine/`

- Python + FontTools
- file/folder/ZIP ingestion
- font-family analysis
- topology checks
- Variable Font build logic
- TTF / OTF / WOFF / WOFF2 / CSS / ZIP output
- JSON CLI contract

The engine has no dependency on the desktop UI.

## Desktop

`desktop/`

- Tauri 2
- drag and drop
- native file selection
- local engine sidecar

The desktop shell talks to the engine through command-line arguments and JSON output. This keeps the engine reusable in a future larger app.
