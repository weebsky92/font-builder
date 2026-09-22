from __future__ import annotations
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

FONT_EXTS = {".ttf", ".otf", ".woff", ".woff2"}
ZIP_EXTS = {".zip"}
IGNORE_PARTS = {"__MACOSX", ".git", ".svn", "node_modules", "Thumbs.db", ".DS_Store"}
IGNORE_PREFIXES = ("README", "LICENSE", "LICENCE", "CHANGELOG", "OFL", "NOTICE")

class IngestSession:
    def __init__(self, max_entries: int = 5000, max_unpacked: int = 2 * 1024**3, nested_zip_depth: int = 2):
        self.max_entries = max_entries
        self.max_unpacked = max_unpacked
        self.nested_zip_depth = nested_zip_depth
        self._tmp = tempfile.TemporaryDirectory(prefix="fontbuilder-")
        self.root = Path(self._tmp.name)
        self.ignored: list[dict] = []

    def close(self):
        self._tmp.cleanup()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def _ignored(self, p: Path) -> bool:
        if any(part in IGNORE_PARTS for part in p.parts):
            return True
        return p.name.upper().startswith(IGNORE_PREFIXES)

    def _safe_extract_zip(self, zpath: Path, dest: Path, depth: int):
        with zipfile.ZipFile(zpath) as z:
            infos = z.infolist()
            if len(infos) > self.max_entries:
                raise ValueError(f"ZIP has too many entries: {len(infos)} > {self.max_entries}")
            total = sum(i.file_size for i in infos)
            if total > self.max_unpacked:
                raise ValueError(f"ZIP is too large after unpacking: {total} bytes")
            dest_resolved = dest.resolve()
            for info in infos:
                raw = Path(info.filename)
                if self._ignored(raw):
                    self.ignored.append({"path": info.filename, "reason": "ignored metadata/docs"})
                    continue
                mode = (info.external_attr >> 16) & 0o170000
                if mode == 0o120000:
                    self.ignored.append({"path": info.filename, "reason": "symlink skipped"})
                    continue
                target = (dest / raw).resolve()
                if target != dest_resolved and dest_resolved not in target.parents:
                    raise ValueError(f"Unsafe ZIP path: {info.filename}")
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)

        if depth < self.nested_zip_depth:
            for nested in list(dest.rglob("*.zip")):
                nested_dest = nested.with_suffix("")
                nested_dest.mkdir(parents=True, exist_ok=True)
                self._safe_extract_zip(nested, nested_dest, depth + 1)

    def collect(self, inputs: list[str]) -> list[Path]:
        files: list[Path] = []
        for idx, raw in enumerate(inputs):
            p = Path(raw).expanduser().resolve()
            if not p.exists():
                raise FileNotFoundError(str(p))
            if p.is_dir():
                candidates = [x for x in p.rglob("*") if x.is_file()]
                for x in candidates:
                    if self._ignored(x.relative_to(p)):
                        self.ignored.append({"path": str(x), "reason": "ignored metadata/docs"})
                    elif x.suffix.lower() in FONT_EXTS:
                        files.append(x)
                    elif x.suffix.lower() in ZIP_EXTS:
                        dest = self.root / f"zip-{idx}-{len(files)}"
                        dest.mkdir(parents=True, exist_ok=True)
                        self._safe_extract_zip(x, dest, 0)
                        files.extend(y for y in dest.rglob("*") if y.is_file() and y.suffix.lower() in FONT_EXTS)
                    else:
                        self.ignored.append({"path": str(x), "reason": "unsupported file"})
            elif p.suffix.lower() in ZIP_EXTS:
                dest = self.root / f"zip-{idx}"
                dest.mkdir(parents=True, exist_ok=True)
                self._safe_extract_zip(p, dest, 0)
                files.extend(y for y in dest.rglob("*") if y.is_file() and y.suffix.lower() in FONT_EXTS)
            elif p.suffix.lower() in FONT_EXTS:
                files.append(p)
            else:
                self.ignored.append({"path": str(p), "reason": "unsupported file"})
        seen = set()
        out = []
        for f in files:
            key = str(f.resolve())
            if key not in seen:
                seen.add(key)
                out.append(f)
        return out
