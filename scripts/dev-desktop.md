# Desktop development

1. Prepare engine venv and install `engine/`.
2. Set `FONTBUILDER_ENGINE_DEV` to the full path of the `fontbuilder-engine` executable from that venv.
3. In `desktop/`: `npm install` then `npm run tauri dev`.

Production packaging will place a frozen engine executable in `src-tauri/engine/` before the Tauri build.
