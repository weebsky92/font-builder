from __future__ import annotations
from copy import deepcopy
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen


def ttf_to_cff_otf(src_path: Path, out_path: Path) -> Path:
    src = TTFont(src_path)
    glyph_order = src.getGlyphOrder()
    glyph_set = src.getGlyphSet()
    charstrings = {}
    for g in glyph_order:
        width = src["hmtx"].metrics[g][0]
        pen = T2CharStringPen(width, glyph_set)
        glyph_set[g].draw(pen)
        charstrings[g] = pen.getCharString()

    upm = src["head"].unitsPerEm
    family = _get_name(src, 1) or out_path.stem
    ps = _get_name(src, 6) or out_path.stem.replace(" ", "")
    fb = FontBuilder(upm, isTTF=False)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(src.getBestCmap() or {})
    fb.setupCFF(ps, {"FullName": family, "FamilyName": family, "Weight": "Regular"}, charstrings, {})
    fb.setupHorizontalMetrics(dict(src["hmtx"].metrics))
    fb.setupHorizontalHeader(ascent=src["hhea"].ascent, descent=src["hhea"].descent, lineGap=src["hhea"].lineGap)
    fb.setupNameTable({
        "familyName": family,
        "styleName": "Regular",
        "fullName": family,
        "psName": ps,
        "uniqueFontIdentifier": ps,
        "version": "Version 1.0",
    })
    os2 = src["OS/2"]
    fb.setupOS2(sTypoAscender=os2.sTypoAscender, sTypoDescender=os2.sTypoDescender,
                sTypoLineGap=os2.sTypoLineGap, usWinAscent=os2.usWinAscent,
                usWinDescent=os2.usWinDescent, usWeightClass=os2.usWeightClass,
                usWidthClass=os2.usWidthClass)
    fb.setupPost(keepGlyphNames=True)
    fb.setupMaxp()
    otf = fb.font

    for tag in ["name", "OS/2", "cmap", "GDEF", "GPOS", "GSUB", "fvar", "STAT", "avar", "BASE", "JSTF", "MATH", "meta", "gasp"]:
        if tag in src:
            otf[tag] = deepcopy(src[tag])
    for attr in ["caretSlopeRise", "caretSlopeRun", "caretOffset", "metricDataFormat"]:
        if hasattr(src["hhea"], attr):
            setattr(otf["hhea"], attr, getattr(src["hhea"], attr))
    for attr in ["fontRevision", "flags", "created", "modified", "lowestRecPPEM", "fontDirectionHint"]:
        if hasattr(src["head"], attr):
            setattr(otf["head"], attr, getattr(src["head"], attr))
    otf.save(out_path)
    check = TTFont(out_path)
    if "CFF " not in check:
        raise RuntimeError("OTF conversion did not produce a CFF table")
    return out_path


def _get_name(font: TTFont, name_id: int) -> str:
    for rec in font["name"].names:
        if rec.nameID == name_id:
            try:
                return rec.toUnicode()
            except Exception:
                pass
    return ""
