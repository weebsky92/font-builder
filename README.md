# Font Builder

Small open-source desktop app for turning static font families into Variable Font packages.

Drop in TTF/OTF files, a folder or a ZIP. The app sorts the font files, ignores the usual junk, checks whether the masters are compatible and builds the output for you.

### What it exports

- TTF
- OTF
- WOFF
- WOFF2
- CSS
- ZIP package

### Why it exists

I wanted a simple tool for a job that usually takes way too many manual steps.

Font Builder works locally, without uploading fonts anywhere and without requiring AI at runtime.

It can build a regular interpolated Variable Font when the masters are compatible. If they are not, it can preserve the original static masters and package them into a discrete variable setup instead.

### Input

You can drop in:

- individual font files
- multiple font files
- whole folders
- ZIP archives

Supported formats: `TTF`, `OTF`, `WOFF`, `WOFF2`.

Files such as README, LICENSE, `.DS_Store`, `__MACOSX`, images and unrelated documents are ignored automatically.

### Platforms

- macOS
- Windows

### Project status

Early alpha. The core engine already works, while the desktop app and cross-platform packaging are still being developed.

### Tech

The project is built with open-source tools, mainly FontTools, Python and Tauri.

The font engine is kept separate from the desktop UI so it can later be reused inside other apps.

### License

MIT

---

## PL

Mała open-source'owa aplikacja do składania statycznych odmian fontu w paczkę Variable Font.

Wrzucasz pliki TTF/OTF, folder albo ZIP. Aplikacja rozpoznaje odmiany, pomija README i inne zbędne pliki, sprawdza zgodność masterów i buduje gotowe TTF, OTF, WOFF, WOFF2, CSS oraz ZIP.

Całość działa lokalnie, bez wysyłania fontów do chmury i bez AI potrzebnego do działania aplikacji.

Projekt jest na wczesnym etapie alpha. Silnik już działa, natomiast desktopowa wersja dla macOS i Windows jest nadal rozwijana.
