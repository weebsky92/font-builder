# CI — desktop builds

Workflow: `.github/workflows/build-desktop.yml`

Targets:
- macOS
- Windows

Triggers:
- manual: GitHub → Actions → Build desktop apps → Run workflow
- version tag matching `v*`

Pipeline:
1. checkout
2. Python 3.12
3. Node 22
4. stable Rust
5. install Font Builder engine + Nuitka + test dependencies
6. run engine tests
7. freeze `engine/nuitka_entry.py` into a local sidecar
8. copy the platform sidecar into `desktop/src-tauri/engine/`
9. install desktop dependencies
10. build Tauri native bundles
11. upload generated bundles as GitHub Actions artifacts

Current alpha CI does not perform production signing or Apple notarization.
