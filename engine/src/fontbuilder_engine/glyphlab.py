from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from .inspect import group_fonts

POLISH_SPECS: dict[str, dict[str, str]] = {
    "Ą": {"base": "A", "kind": "ogonek"},
    "Ć": {"base": "C", "kind": "acute"},
    "Ę": {"base": "E", "kind": "ogonek"},
    "Ł": {"base": "L", "kind": "stroke"},
    "Ń": {"base": "N", "kind": "acute"},
    "Ó": {"base": "O", "kind": "acute"},
    "Ś": {"base": "S", "kind": "acute"},
    "Ź": {"base": "Z", "kind": "acute"},
    "Ż": {"base": "Z", "kind": "dot"},
    "ą": {"base": "a", "kind": "ogonek"},
    "ć": {"base": "c", "kind": "acute"},
    "ę": {"base": "e", "kind": "ogonek"},
    "ł": {"base": "l", "kind": "stroke"},
    "ń": {"base": "n", "kind": "acute"},
    "ó": {"base": "o", "kind": "acute"},
    "ś": {"base": "s", "kind": "acute"},
    "ź": {"base": "z", "kind": "acute"},
    "ż": {"base": "z", "kind": "dot"},
}

MARK_CANDIDATES = {
    "acute": {
        "codepoints": [0x0301, 0x00B4],
        "names": ["acutecomb", "acute", "acuteaccent", "combiningacuteaccent"],
    },
    "dot": {
        "codepoints": [0x0307, 0x02D9],
        "names": ["dotaccent", "dotaccentcomb", "dotabove", "combiningdotabove"],
    },
    "ogonek": {
        "codepoints": [0x0328, 0x02DB],
        "names": ["ogonek", "ogonekcomb", "combiningogonek"],
    },
}


def _best_cmap(font: TTFont) -> dict[int, str]:
    return font.getBestCmap() or {}


def _glyph_for_char(font: TTFont, char: str) -> str | None:
    return _best_cmap(font).get(ord(char))


def _find_mark(font: TTFont, kind: str) -> str | None:
    candidates = MARK_CANDIDATES.get(kind)
    if not candidates:
        return None

    cmap = _best_cmap(font)
    for cp in candidates["codepoints"]:
        if cp in cmap:
            return cmap[cp]

    order = font.getGlyphOrder()
    lower = {name.lower(): name for name in order}
    for name in candidates["names"]:
        if name.lower() in lower:
            return lower[name.lower()]

    return None


def _bounds(font: TTFont, glyph_name: str) -> tuple[float, float, float, float]:
    glyph_set = font.getGlyphSet()
    pen = BoundsPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    if pen.bounds is None:
        return (0.0, 0.0, 0.0, 0.0)
    return tuple(float(v) for v in pen.bounds)


def _path(font: TTFont, glyph_name: str | None) -> str:
    if not glyph_name:
        return ""
    glyph_set = font.getGlyphSet()
    pen = SVGPathPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    return pen.getCommands()


def _generated_name(char: str) -> str:
    cp = ord(char)
    return f"uni{cp:04X}" if cp <= 0xFFFF else f"u{cp:X}"


def _default_recipe(font: TTFont, char: str) -> dict[str, Any]:
    spec = POLISH_SPECS[char]
    base_name = _glyph_for_char(font, spec["base"])
    if not base_name:
        return {
            "char": char,
            "base": spec["base"],
            "kind": spec["kind"],
            "repairable": False,
            "reason": "missing-base",
        }

    upm = float(font["head"].unitsPerEm)
    bx0, by0, bx1, by1 = _bounds(font, base_name)
    bw = max(1.0, bx1 - bx0)
    bh = max(1.0, by1 - by0)

    if spec["kind"] == "stroke":
        return {
            "char": char,
            "base": spec["base"],
            "kind": "stroke",
            "repairable": True,
            "dx": 0.0,
            "dy": 0.0,
            "scale": 1.0,
            "rotation": -10.0,
            "thickness": round(max(upm * 0.055, bw * 0.09), 2),
            "stroke_y": round(by0 + bh * (0.56 if char == "Ł" else 0.50), 2),
            "stroke_width": round(bw * (0.82 if char == "Ł" else 0.92), 2),
            "stroke_x": round(bx0 - bw * 0.06, 2),
        }

    mark_name = _find_mark(font, spec["kind"])
    if not mark_name:
        return {
            "char": char,
            "base": spec["base"],
            "kind": spec["kind"],
            "repairable": False,
            "reason": "missing-mark",
        }

    mx0, my0, mx1, my1 = _bounds(font, mark_name)
    mark_cx = (mx0 + mx1) / 2.0
    base_cx = (bx0 + bx1) / 2.0
    scale = 1.0

    if spec["kind"] in {"acute", "dot"}:
        gap = max(upm * 0.025, 18.0)
        dx = base_cx - mark_cx
        dy = by1 + gap - my0
    else:
        target_cx = bx0 + bw * (0.72 if char in {"Ą", "Ę"} else 0.68)
        target_top = by0 + upm * 0.02
        dx = target_cx - mark_cx
        dy = target_top - my1

    return {
        "char": char,
        "base": spec["base"],
        "kind": spec["kind"],
        "repairable": True,
        "mark": mark_name,
        "dx": round(dx, 2),
        "dy": round(dy, 2),
        "scale": scale,
        "rotation": 0.0,
    }


def _source_payload(source) -> dict[str, Any]:
    return {
        "path": str(source.path),
        "weight": source.weight,
        "italic": source.italic,
        "subfamily": source.subfamily,
    }


def audit_paths(paths: list[Path]) -> dict[str, Any]:
    groups = group_fonts(paths)
    families = []

    for family_name, sources in groups.items():
        fonts = [(source, TTFont(source.path, lazy=False)) for source in sources]
        chars = []

        for char, spec in POLISH_SPECS.items():
            present = 0
            missing = []
            repairable = True

            for source, font in fonts:
                if _glyph_for_char(font, char):
                    present += 1
                    continue

                recipe = _default_recipe(font, char)
                if not recipe.get("repairable"):
                    repairable = False
                missing.append({
                    **_source_payload(source),
                    "repairable": bool(recipe.get("repairable")),
                    "reason": recipe.get("reason"),
                })

            if present == len(fonts):
                status = "present"
            elif present == 0:
                status = "missing"
            else:
                status = "partial"

            preview_font = min(
                fonts,
                key=lambda item: (item[0].italic, abs(item[0].weight - 400)),
            )[1]
            suggested = _default_recipe(preview_font, char)

            chars.append({
                "char": char,
                "codepoint": f"U+{ord(char):04X}",
                "base": spec["base"],
                "kind": spec["kind"],
                "status": status,
                "present": present,
                "total": len(fonts),
                "missing": missing,
                "repairable": repairable if status != "present" else True,
                "suggested_recipe": suggested,
            })

        missing_count = sum(1 for item in chars if item["status"] != "present")
        families.append({
            "family": family_name,
            "masters": len(sources),
            "missing_count": missing_count,
            "complete": missing_count == 0,
            "chars": chars,
        })

    return {"families": families}


def preview_path(paths: list[Path], char: str, recipe: dict[str, Any] | None = None) -> dict[str, Any]:
    if char not in POLISH_SPECS:
        raise ValueError(f"Unsupported Glyph Lab character: {char}")

    groups = group_fonts(paths)
    if not groups:
        raise ValueError("No font families found")

    family_name, sources = next(iter(groups.items()))
    source = min(sources, key=lambda s: (s.italic, abs(s.weight - 400)))
    font = TTFont(source.path, lazy=False)
    spec = POLISH_SPECS[char]
    base_name = _glyph_for_char(font, spec["base"])
    if not base_name:
        raise ValueError(f"Missing base glyph {spec['base']} in preview master")

    default_recipe = _default_recipe(font, char)
    active_recipe = {**default_recipe, **(recipe or {})}
    mark_name = None if spec["kind"] == "stroke" else _find_mark(font, spec["kind"])

    cmap_target = _glyph_for_char(font, char)
    advance = font["hmtx"].metrics[base_name][0]
    ascent = int(getattr(font.get("OS/2"), "sTypoAscender", font["hhea"].ascent))
    descent = int(getattr(font.get("OS/2"), "sTypoDescender", font["hhea"].descent))

    return {
        "family": family_name,
        "char": char,
        "source": _source_payload(source),
        "upm": font["head"].unitsPerEm,
        "advance": advance,
        "ascent": ascent,
        "descent": descent,
        "base_name": base_name,
        "base_path": _path(font, base_name),
        "base_bounds": _bounds(font, base_name),
        "mark_name": mark_name,
        "mark_path": _path(font, mark_name),
        "mark_bounds": _bounds(font, mark_name) if mark_name else None,
        "existing_name": cmap_target,
        "existing_path": _path(font, cmap_target),
        "recipe": active_recipe,
    }


def _add_unicode_mapping(font: TTFont, codepoint: int, glyph_name: str) -> None:
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[codepoint] = glyph_name


def _build_accent_glyph(font: TTFont, base_name: str, mark_name: str, recipe: dict[str, Any]):
    scale = float(recipe.get("scale", 1.0))
    angle = math.radians(float(recipe.get("rotation", 0.0)))
    cos_a = math.cos(angle) * scale
    sin_a = math.sin(angle) * scale
    dx = float(recipe.get("dx", 0.0))
    dy = float(recipe.get("dy", 0.0))

    pen = TTGlyphPen(font.getGlyphSet())
    pen.addComponent(base_name, (1, 0, 0, 1, 0, 0))
    pen.addComponent(mark_name, (cos_a, sin_a, -sin_a, cos_a, dx, dy))
    return pen.glyph()


def _build_stroke_glyph(font: TTFont, base_name: str, recipe: dict[str, Any]):
    glyph_set = font.getGlyphSet()
    pen = TTGlyphPen(glyph_set)
    glyph_set[base_name].draw(pen)

    x = float(recipe.get("stroke_x", 0.0)) + float(recipe.get("dx", 0.0))
    y = float(recipe.get("stroke_y", 0.0)) + float(recipe.get("dy", 0.0))
    width = float(recipe.get("stroke_width", font["head"].unitsPerEm * 0.5))
    thickness = max(1.0, float(recipe.get("thickness", font["head"].unitsPerEm * 0.055)))
    rotation = math.radians(float(recipe.get("rotation", -10.0)))
    scale = max(0.1, float(recipe.get("scale", 1.0)))
    width *= scale
    thickness *= scale

    vx = math.cos(rotation) * width
    vy = math.sin(rotation) * width
    nx = -math.sin(rotation) * thickness / 2.0
    ny = math.cos(rotation) * thickness / 2.0

    p1 = (x + nx, y + ny)
    p2 = (x + vx + nx, y + vy + ny)
    p3 = (x + vx - nx, y + vy - ny)
    p4 = (x - nx, y - ny)

    pen.moveTo(p1)
    pen.lineTo(p2)
    pen.lineTo(p3)
    pen.lineTo(p4)
    pen.closePath()
    return pen.glyph()


def repair_paths(paths: list[Path], output_dir: Path, recipes: list[dict[str, Any]]) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    recipe_map = {item["char"]: item for item in recipes if item.get("char") in POLISH_SPECS}
    if not recipe_map:
        raise ValueError("No Glyph Lab recipes supplied")

    groups = group_fonts(paths)
    outputs = []
    repaired = []

    for family_name, sources in groups.items():
        family_dir = output_dir / family_name.replace("/", "-")
        family_dir.mkdir(parents=True, exist_ok=True)

        for source in sources:
            font = TTFont(source.path, lazy=False)
            if "glyf" not in font:
                raise ValueError(f"Glyph Lab currently supports TrueType glyf sources only: {source.path.name}")

            order = list(font.getGlyphOrder())
            cmap = _best_cmap(font)

            for char, recipe in recipe_map.items():
                spec = POLISH_SPECS[char]
                if ord(char) in cmap and not recipe.get("force", False):
                    continue

                base_name = _glyph_for_char(font, spec["base"])
                if not base_name:
                    raise ValueError(f"{source.path.name}: missing base glyph {spec['base']} for {char}")

                resolved = {**_default_recipe(font, char), **recipe}
                if not resolved.get("repairable", True):
                    raise ValueError(f"{source.path.name}: {char} is not automatically repairable")

                glyph_name = _generated_name(char)
                if spec["kind"] == "stroke":
                    glyph = _build_stroke_glyph(font, base_name, resolved)
                else:
                    mark_name = resolved.get("mark") or _find_mark(font, spec["kind"])
                    if not mark_name:
                        raise ValueError(f"{source.path.name}: missing {spec['kind']} mark for {char}")
                    glyph = _build_accent_glyph(font, base_name, mark_name, resolved)

                if glyph_name not in order:
                    order.append(glyph_name)

                font["glyf"].glyphs[glyph_name] = glyph
                font["hmtx"].metrics[glyph_name] = font["hmtx"].metrics[base_name]
                _add_unicode_mapping(font, ord(char), glyph_name)
                repaired.append({
                    "font": source.path.name,
                    "char": char,
                    "glyph": glyph_name,
                })

            font.setGlyphOrder(order)
            font["glyf"].glyphOrder = list(order)

            out_path = family_dir / source.path.name
            font.save(out_path, reorderTables=True)
            outputs.append(str(out_path))

    return {
        "output_dir": str(output_dir),
        "outputs": outputs,
        "repaired": repaired,
        "count": len(repaired),
    }
