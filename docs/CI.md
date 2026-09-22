# CI

Workflow: `.github/workflows/build-desktop.yml`

Targets:
- macOS
- Windows

Pipeline:
1. checkout
2. Python 3.12
3. Node 22
4. stable Rust
5. install and test engine
6. compile local engine sidecar with Nuitka
7. install desktop dependencies
8. build Tauri bundle
9. upload build artifacts

The alpha pipeline does not perform production signing or Apple notarization yet.
