# Font Builder

> **0.1.0-alpha.2** · working product name · macOS + Windows · MIT

Open-source desktop tool and reusable local engine for turning static font families into Variable Font packages.

**No cloud, no runtime AI, no font uploads.** Font processing happens locally on the user's computer.

## English

### What it does

Drop individual font files, a whole folder, or a ZIP archive. Font Builder scans the input, ignores unrelated files, groups font families, checks master compatibility and builds a ready-to-use package.

**Input**

- TTF
- OTF
- WOFF
- WOFF2
- folders
- ZIP archives, including nested ZIPs within safe limits

Files such as `README`, `LICENSE`, `.DS_Store`, `Thumbs.db`, `__MACOSX`, images and unrelated documents are ignored automatically.

**Output**

- Variable TTF
- real CFF OTF
- WOFF
- WOFF2
- CSS `@font-face`
- JSON build report
- ZIP package

### Build modes

- **TRUE VARIABLE** when source masters are interpolation-compatible.
- **DISCRETE VARIABLE** when outlines have incompatible topology. Original source outlines are preserved and selected through OpenType FeatureVariations.
- **AUTO** chooses the safest available mode automatically.

### Architecture

```text
engine/    reusable Python + FontTools engine and JSON CLI
desktop/   Tauri 2 desktop shell for macOS and Windows
```

The engine has no GUI dependency. It is intentionally reusable from another application, CI pipeline, desktop shell or future larger product.

### Quick start: engine

```bash
cd engine
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\\Scripts\\activate
pip install -e .
fontbuilder-engine analyze /path/to/fonts-or-pack.zip
fontbuilder-engine build /path/to/fonts-or-pack.zip -o ./output
```

The CLI outputs JSON only.

### Desktop builds

GitHub Actions contains a macOS + Windows build matrix. Run **Actions → Build desktop apps → Run workflow**, or push a version tag such as `v0.1.0-alpha.2`.

### Alpha limitations

- Variable builds currently use TrueType `glyf` source masters.
- CFF/CFF2/OTF sources are detected and analyzed, but variable compilation from CFF/CFF2 source masters is not enabled yet.
- Discrete builds currently require the same glyph set across masters. Glyph-set normalization is planned.
- Production code signing/notarization is not configured yet.

---

## Polski

### Co robi aplikacja

Wrzuć pojedyncze pliki fontów, cały folder albo archiwum ZIP. Font Builder analizuje zawartość, ignoruje niepotrzebne pliki, grupuje rodziny, sprawdza zgodność masterów i buduje gotową paczkę Variable Font.

**Wejście**

- TTF
- OTF
- WOFF
- WOFF2
- foldery
- archiwa ZIP, również zagnieżdżone w bezpiecznych limitach

Pliki typu `README`, `LICENSE`, `.DS_Store`, `Thumbs.db`, `__MACOSX`, grafiki i dokumenty niezwiązane z fontami są automatycznie pomijane.

**Wyjście**

- Variable TTF
- prawdziwy OTF z konturami CFF
- WOFF
- WOFF2
- CSS `@font-face`
- raport JSON
- końcowa paczka ZIP

### Tryby budowania

- **TRUE VARIABLE** gdy mastery są zgodne do interpolacji.
- **DISCRETE VARIABLE** gdy topologia konturów się różni. Oryginalne kształty są zachowane i przełączane przez OpenType FeatureVariations.
- **AUTO** sam wybiera najbezpieczniejszy tryb.

### Architektura

```text
engine/    niezależny silnik Python + FontTools i JSON CLI
desktop/   aplikacja Tauri 2 dla macOS i Windows
```

Silnik nie zależy od GUI, dzięki czemu później może zostać bezpośrednio zintegrowany z większą aplikacją.

### Szybki start silnika

```bash
cd engine
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\\Scripts\\activate
pip install -e .
fontbuilder-engine analyze /sciezka/do/fontow-lub-paczki.zip
fontbuilder-engine build /sciezka/do/fontow-lub-paczki.zip -o ./output
```

CLI zwraca wyłącznie JSON.

### Build aplikacji desktopowej

Repo zawiera GitHub Actions dla macOS i Windows. Można uruchomić **Actions → Build desktop apps → Run workflow** albo wypchnąć tag wersji, np. `v0.1.0-alpha.2`.

### Ograniczenia wersji alpha

- Budowanie Variable Font działa obecnie dla źródeł TrueType `glyf`.
- CFF/CFF2/OTF są wykrywane i analizowane, ale kompilacja variable bezpośrednio z takich masterów jeszcze nie jest aktywna.
- Tryb discrete wymaga obecnie tego samego zestawu glifów we wszystkich masterach. Normalizacja zestawów glifów jest w roadmapie.
- Produkcyjne podpisywanie aplikacji i notarization nie są jeszcze skonfigurowane.

## Safety / Bezpieczeństwo

ZIP extraction blocks path traversal and symlink entries, uses extraction limits and works inside an isolated temporary directory. Font files are processed locally.

Rozpakowywanie ZIP blokuje path traversal i symlinki, korzysta z limitów bezpieczeństwa i odbywa się w izolowanym katalogu tymczasowym. Fonty są przetwarzane lokalnie.

## License

MIT. See [`LICENSE`](LICENSE).
