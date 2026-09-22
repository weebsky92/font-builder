# Install / test - 0.1.0-alpha.2

## Engine

```bash
cd engine
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -e .
fontbuilder-engine analyze /path/to/font-pack.zip
fontbuilder-engine build /path/to/font-pack.zip -o ./output
```

Expected output per family:
- `*-Variable.ttf`
- `*-Variable.otf`
- `*-Variable.woff`
- `*-Variable.woff2`
- `*-Variable.css`
- `build-report.json`
- `*-Variable-Pack.zip`

## Desktop development

Requires Node.js, Rust and Tauri platform prerequisites.

```bash
cd desktop
npm install
npm run tauri dev
```

For development, set `FONTBUILDER_ENGINE_DEV` to an executable or wrapper that starts the local engine.

## CI

GitHub Actions builds macOS and Windows bundles from `.github/workflows/build-desktop.yml`.
