from __future__ import annotations
import re
from pathlib import Path
from fontTools.ttLib import TTFont
from .model import FontSource, Analysis

WEIGHT_WORDS = re.compile(r"\b(Thin|Extra\s*Light|ExLight|Ultra\s*Light|Light|Regular|Book|Normal|Medium|Semi\s*Bold|Demi\s*Bold|Bold|Extra\s*Bold|Ultra\s*Bold|Black|Heavy|Italic|Oblique)\b", re.I)

CANONICAL_WEIGHTS = {
    "thin": 100, "extralight": 200, "exlight": 200, "ultralight": 200,
    "light": 300, "regular": 400, "book": 400, "normal": 400,
    "medium": 500, "semibold": 600, "demibold": 600,
    "bold": 700, "extrabold": 800, "ultrabold": 800,
    "black": 900, "heavy": 900,
}


def _name(font: TTFont, ids: tuple[int, ...]) -> str:
    for nid in ids:
        vals = []
        for rec in font["name"].names:
            if rec.nameID == nid:
                try:
                    vals.append(rec.toUnicode().strip())
                except Exception:
                    pass
        if vals:
            return vals[0]
    return ""


def _family(font: TTFont) -> str:
    family = _name(font, (16, 1)) or "Unknown Family"
    family = WEIGHT_WORDS.sub("", family)
    family = re.sub(r"\s+", " ", family).strip(" -")
    return family or "Unknown Family"


def inspect_font(path: Path) -> FontSource:
    f = TTFont(path, lazy=False)
    family = _family(f)
    subfamily = _name(f, (17, 2)) or "Regular"
    ps = _name(f, (6,)) or path.stem
    weight = int(getattr(f.get("OS/2"), "usWeightClass", 400) or 400)
    style_key = re.sub(r"[^a-z]", "", subfamily.lower().replace("italic", "").replace("oblique", ""))
    if style_key in CANONICAL_WEIGHTS:
        weight = CANONICAL_WEIGHTS[style_key]
    fs = int(getattr(f.get("OS/2"), "fsSelection", 0) or 0)
    mac = int(getattr(f.get("head"), "macStyle", 0) or 0)
    italic = bool(fs & 0x01 or mac & 0x02 or re.search(r"italic|oblique", subfamily, re.I))
    if "glyf" in f:
        outline = "truetype"
    elif "CFF2" in f:
        outline = "cff2"
    elif "CFF " in f:
        outline = "cff"
    else:
        outline = "unknown"
    return FontSource(path=path, family=family, subfamily=subfamily, postscript_name=ps,
                      weight=weight, italic=italic, outline=outline,
                      glyph_count=len(f.getGlyphOrder()), upm=f["head"].unitsPerEm)


def group_fonts(paths: list[Path]) -> dict[str, list[FontSource]]:
    groups: dict[str, list[FontSource]] = {}
    for p in paths:
        src = inspect_font(p)
        groups.setdefault(src.family, []).append(src)
    for family in groups:
        groups[family].sort(key=lambda s: (s.italic, s.weight, s.path.name.lower()))
    return groups


def _glyph_signature(font: TTFont, name: str):
    g = font["glyf"][name]
    if g.isComposite():
        return ("composite", tuple(c.glyphName for c in g.components))
    coords, end_pts, _ = g.getCoordinates(font["glyf"])
    return ("simple", g.numberOfContours, len(coords), tuple(end_pts))


def analyze_family(family: str, fonts: list[FontSource]) -> Analysis:
    warnings: list[str] = []
    if not fonts:
        raise ValueError("No fonts")
    if any(s.outline != "truetype" for s in fonts):
        warnings.append("This alpha builds variable fonts from TrueType-outline masters. CFF/CFF2 inputs are detected but not yet buildable.")
        return Analysis(family, fonts, False, False, 0, 0, "unsupported-source-outline", warnings)
    tt = [TTFont(s.path) for s in fonts]
    orders = [f.getGlyphOrder() for f in tt]
    same_order = all(o == orders[0] for o in orders[1:])
    common = set(orders[0])
    for o in orders[1:]:
        common &= set(o)
    mismatches = 0
    for g in orders[0]:
        if g not in common:
            mismatches += 1
            continue
        sigs = [_glyph_signature(f, g) for f in tt]
        if len(set(sigs)) != 1:
            mismatches += 1
    compatible = same_order and mismatches == 0
    mode = "true-variable" if compatible else "discrete-variable"
    if not compatible:
        warnings.append(f"{mismatches} glyphs are not interpolation-compatible; AUTO will preserve original masters using FeatureVariations.")
    slots = {}
    for s in fonts:
        key = (s.italic, s.weight)
        if key in slots:
            warnings.append(f"Duplicate master slot: weight={s.weight}, italic={s.italic}: {slots[key].path.name}, {s.path.name}")
        slots[key] = s
    return Analysis(family, fonts, compatible, same_order, len(common), mismatches, mode, warnings)
