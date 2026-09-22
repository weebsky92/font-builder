# Install / test — 0.1.0-alpha.1

## Engine test

```bash
cd engine
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell
# .venv\\Scripts\\Activate.ps1

pip install -e .
fontbuilder-engine analyze /path/to/font-pack.zip
fontbuilder-engine build /path/to/font-pack.zip -o ./output
```

Expected output directory per family contains:
- `*-Variable.ttf`
- `*-Variable.otf`
- `*-Variable.woff`
- `*-Variable.woff2`
- `*-Variable.css`
- `build-report.json`
- `*-Variable-Pack.zip`

## Desktop dev

Requires Node.js + Rust toolchain + platform Tauri prerequisites.

```bash
cd desktop
npm install
```

Prepare the Python engine command and point `FONTBUILDER_ENGINE_DEV` to it, then:

```bash
npm run tauri dev
```

## Production packaging

Not yet certified in Alpha 1. Production builds require platform-local packaging, signing and macOS notarization.
