from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any

from fontTools.ttLib import TTFont

from .font_safety import prepare_font_for_save
from .inspect import inspect_font


NAME_IDS = {
    "family": (1, 16),
    "style": (2, 17),
    "full_name": (4,),
    "postscript": (6,),
    "version": (5,),
}


def _name(font: TTFont, ids: tuple[int, ...]) -> str:
    if "name" not in font:
        return ""
    for nid in ids:
        for record in font["name"].names:
            if record.nameID == nid:
                try:
                    value = record.toUnicode().strip()
                except Exception:
                    continue
                if value:
                    return value
    return ""


def _font_order(paths: list[Path]) -> list[Path]:
    return sorted(paths, key=lambda p: (p.name.lower(), str(p).lower()))


def _unicode_entries(font: TTFont) -> list[dict[str, Any]]:
    cmap = font.getBestCmap() or {}
    entries = []
    for cp, glyph_name in sorted(cmap.items()):
        if cp < 0 or cp > 0x10FFFF:
            continue
        try:
            char = chr(cp)
        except ValueError:
            char = ""
        entries.append({
            "codepoint": cp,
            "unicode": f"U+{cp:04X}",
            "char": char,
            "glyph": glyph_name,
        })
    return entries


def _issue(level: str, code: str, message: str) -> dict[str, str]:
    return {"level": level, "code": code, "message": message}


def _font_health(font: TTFont, source) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    required = {
        "family": _name(font, NAME_IDS["family"]),
        "style": _name(font, NAME_IDS["style"]),
        "full": _name(font, NAME_IDS["full_name"]),
        "postscript": _name(font, NAME_IDS["postscript"]),
    }
    for key, value in required.items():
        if not value:
            issues.append(_issue("error", f"missing-name-{key}", f"Missing required name: {key}"))

    cmap = font.getBestCmap() or {}
    if not cmap:
        issues.append(_issue("error", "missing-cmap", "No usable Unicode cmap found."))

    if source.upm not in {1000, 2048}:
        issues.append(_issue("info", "unusual-upm", f"Unusual units per em: {source.upm}."))

    if "GPOS" not in font and "kern" not in font:
        issues.append(_issue("info", "no-kerning-table", "No GPOS or legacy kern table detected."))

    if "GSUB" not in font:
        issues.append(_issue("info", "no-gsub", "No GSUB table detected."))

    if source.outline == "unknown":
        issues.append(_issue("error", "unknown-outline", "Unsupported or unknown outline type."))

    if not issues:
        issues.append(_issue("ok", "healthy", "No basic structural problems detected."))

    return issues


def _family_health(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if not items:
        return [_issue("error", "empty-family", "No fonts were found.")]

    upms = sorted({item["upm"] for item in items})
    if len(upms) > 1:
        issues.append(_issue("warning", "mixed-upm", f"Different UPM values across family: {upms}."))

    slots: dict[tuple[bool, int], str] = {}
    duplicates = []
    for item in items:
        key = (bool(item["italic"]), int(item["weight"]))
        if key in slots:
            duplicates.append(f"{slots[key]} / {item['file_name']}")
        slots[key] = item["file_name"]
    if duplicates:
        issues.append(_issue("warning", "duplicate-slots", "Duplicate weight/style slots: " + "; ".join(duplicates)))

    glyph_sets = [set(entry["codepoint"] for entry in item["characters"]) for item in items]
    if glyph_sets:
        first = glyph_sets[0]
        if any(glyphs != first for glyphs in glyph_sets[1:]):
            common = set.intersection(*glyph_sets)
            union = set.union(*glyph_sets)
            issues.append(_issue(
                "warning",
                "different-cmaps",
                f"Character coverage differs across masters ({len(common)} common / {len(union)} total codepoints).",
            ))

    if not issues:
        issues.append(_issue("ok", "healthy-family", "Family-level checks passed."))

    return issues


def inspect_tools(paths: list[Path], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    ordered = _font_order(paths)
    items: list[dict[str, Any]] = []

    for index, path in enumerate(ordered):
        source = inspect_font(path)
        font = TTFont(path, lazy=False)

        suffix = path.suffix.lower() or ".ttf"
        preview_name = f"{index:02d}-{path.stem}{suffix}"
        preview_path = output_dir / preview_name
        shutil.copy2(path, preview_path)

        names = {
            "family": _name(font, NAME_IDS["family"]) or source.family,
            "style": _name(font, NAME_IDS["style"]) or source.subfamily,
            "full_name": _name(font, NAME_IDS["full_name"]) or f"{source.family} {source.subfamily}".strip(),
            "postscript": _name(font, NAME_IDS["postscript"]) or source.postscript_name,
            "version": _name(font, NAME_IDS["version"]) or "Version 1.0",
        }

        chars = _unicode_entries(font)
        items.append({
            "index": index,
            "file_name": path.name,
            "source_path": str(path),
            "preview_path": str(preview_path),
            "family": source.family,
            "style": source.subfamily,
            "postscript_name": source.postscript_name,
            "weight": source.weight,
            "italic": source.italic,
            "outline": source.outline,
            "glyph_count": source.glyph_count,
            "upm": source.upm,
            "names": names,
            "characters": chars,
            "character_count": len(chars),
            "tables": sorted(font.keys()),
            "health": _font_health(font, source),
        })

    return {
        "fonts": items,
        "family_health": _family_health(items),
        "output_dir": str(output_dir),
    }


def _set_name(font: TTFont, ids: tuple[int, ...], value: str) -> None:
    if "name" not in font:
        return

    name_table = font["name"]
    for record in name_table.names:
        if record.nameID not in ids:
            continue
        try:
            encoding = record.getEncoding()
            record.string = value.encode(encoding, errors="replace")
        except Exception:
            pass

    for nid in ids:
        name_table.setName(value, nid, 3, 1, 0x409)
        name_table.setName(value, nid, 0, 4, 0)


def _safe_postscript(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    return cleaned.strip("-") or "FontBuilder-Font"


def update_metadata(
    paths: list[Path],
    output_dir: Path,
    index: int,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    ordered = _font_order(paths)
    if index < 0 or index >= len(ordered):
        raise ValueError(f"Font index out of range: {index}")

    source_path = ordered[index]
    font = TTFont(source_path, lazy=False)

    family = str(metadata.get("family") or _name(font, NAME_IDS["family"]) or source_path.stem).strip()
    style = str(metadata.get("style") or _name(font, NAME_IDS["style"]) or "Regular").strip()
    full_name = str(metadata.get("full_name") or f"{family} {style}").strip()
    postscript = _safe_postscript(str(metadata.get("postscript") or f"{family}-{style}"))
    version = str(metadata.get("version") or _name(font, NAME_IDS["version"]) or "Version 1.0").strip()

    values = {
        "family": family,
        "style": style,
        "full_name": full_name,
        "postscript": postscript,
        "version": version,
    }
    for key, ids in NAME_IDS.items():
        _set_name(font, ids, values[key])

    if "CFF " in font:
        try:
            top = font["CFF "].cff.topDictIndex[0]
            top.FamilyName = family
            top.FullName = full_name
            font["CFF "].cff.fontNames[0] = postscript
        except Exception:
            pass

    match = re.search(r"(\d+(?:\.\d+)?)", version)
    if match and "head" in font:
        try:
            font["head"].fontRevision = float(match.group(1))
        except Exception:
            pass

    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / source_path.name
    prepare_font_for_save(font)
    font.save(out_path, reorderTables=True)

    return {
        "source": source_path.name,
        "output": str(out_path),
        "names": values,
    }


def convert_formats(
    paths: list[Path],
    output_dir: Path,
    formats: list[str],
) -> dict[str, Any]:
    allowed = [fmt for fmt in formats if fmt in {"woff", "woff2"}]
    if not allowed:
        raise ValueError("Choose at least one supported output format: woff or woff2")

    output_dir.mkdir(parents=True, exist_ok=True)
    ordered = _font_order(paths)
    outputs: list[str] = []
    css_rules: list[str] = []

    for source_path in ordered:
        source_font = TTFont(source_path, lazy=False)
        family = _name(source_font, NAME_IDS["family"]) or source_path.stem
        style_name = _name(source_font, NAME_IDS["style"]) or "Regular"
        weight = int(getattr(source_font.get("OS/2"), "usWeightClass", 400) or 400)
        fs = int(getattr(source_font.get("OS/2"), "fsSelection", 0) or 0)
        mac = int(getattr(source_font.get("head"), "macStyle", 0) or 0)
        italic = bool(fs & 0x01 or mac & 0x02 or re.search(r"italic|oblique", style_name, re.I))

        src_parts: list[str] = []
        for fmt in allowed:
            font = TTFont(source_path, lazy=False)
            prepare_font_for_save(font)
            font.flavor = fmt
            out_path = output_dir / f"{source_path.stem}.{fmt}"
            font.save(out_path)
            outputs.append(str(out_path))
            css_format = "woff2" if fmt == "woff2" else "woff"
            src_parts.append(f"url('./{out_path.name}') format('{css_format}')")

        css_family = family.replace("\\", "\\\\").replace("'", "\\'")
        css_rules.append(
            "@font-face {\n"
            f"  font-family: '{css_family}';\n"
            f"  src: {', '.join(src_parts)};\n"
            f"  font-weight: {weight};\n"
            f"  font-style: {'italic' if italic else 'normal'};\n"
            "  font-display: swap;\n"
            "}\n"
        )

    css_path = output_dir / "fonts.css"
    css_path.write_text("\n".join(css_rules), encoding="utf-8")
    outputs.append(str(css_path))

    zip_path = output_dir / "FontBuilder-Webfonts.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in outputs:
            path = Path(item)
            archive.write(path, arcname=path.name)

    return {
        "formats": allowed,
        "outputs": outputs,
        "zip": str(zip_path),
        "css": str(css_path),
        "count": len(outputs),
    }
