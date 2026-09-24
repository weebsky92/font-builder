from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

from fontbuilder_engine.glyphlab import audit_paths, repair_paths


def _rect(x0, y0, x1, y1):
    pen = TTGlyphPen(None)
    pen.moveTo((x0, y0))
    pen.lineTo((x1, y0))
    pen.lineTo((x1, y1))
    pen.lineTo((x0, y1))
    pen.closePath()
    return pen.glyph()


def _font(path: Path):
    fb = FontBuilder(1000, isTTF=True)
    order = [".notdef", "C", "acutecomb"]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x0043: "C", 0x0301: "acutecomb"})
    fb.setupGlyf({
        ".notdef": _rect(50, 0, 500, 700),
        "C": _rect(80, 0, 620, 700),
        "acutecomb": _rect(0, 0, 120, 180),
    })
    fb.setupHorizontalMetrics({
        ".notdef": (600, 0),
        "C": (700, 40),
        "acutecomb": (0, 0),
    })
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        "familyName": "GlyphLabTest",
        "styleName": "Regular",
        "fullName": "GlyphLabTest Regular",
        "psName": "GlyphLabTest-Regular",
    })
    fb.setupOS2(
        sTypoAscender=800,
        sTypoDescender=-200,
        usWinAscent=800,
        usWinDescent=200,
        usWeightClass=400,
    )
    fb.setupPost()
    fb.setupMaxp()
    fb.save(path)


def test_audit_and_repair_polish_acute(tmp_path: Path):
    src = tmp_path / "test.ttf"
    _font(src)

    audit = audit_paths([src])
    family = audit["families"][0]
    item = next(x for x in family["chars"] if x["char"] == "Ć")

    assert item["status"] == "missing"
    assert item["repairable"] is True

    out = tmp_path / "repaired"
    result = repair_paths([src], out, [item["suggested_recipe"]])
    repaired_font = TTFont(result["outputs"][0])

    assert 0x0106 in repaired_font.getBestCmap()


def _cff_rect(width, x0, y0, x1, y1):
    pen = T2CharStringPen(width, None)
    pen.moveTo((x0, y0))
    pen.lineTo((x1, y0))
    pen.lineTo((x1, y1))
    pen.lineTo((x0, y1))
    pen.closePath()
    return pen.getCharString()


def _cff_font(path: Path):
    fb = FontBuilder(1000, isTTF=False)
    order = [".notdef", "C", "acutecomb"]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x0043: "C", 0x0301: "acutecomb"})
    fb.setupCFF(
        "GlyphLabCFF-Regular",
        {"FullName": "GlyphLabCFF Regular", "FamilyName": "GlyphLabCFF", "Weight": "Regular"},
        {
            ".notdef": _cff_rect(600, 50, 0, 500, 700),
            "C": _cff_rect(700, 80, 0, 620, 700),
            "acutecomb": _cff_rect(0, 0, 0, 120, 180),
        },
        {},
    )
    fb.setupHorizontalMetrics({
        ".notdef": (600, 0),
        "C": (700, 40),
        "acutecomb": (0, 0),
    })
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        "familyName": "GlyphLabCFF",
        "styleName": "Regular",
        "fullName": "GlyphLabCFF Regular",
        "psName": "GlyphLabCFF-Regular",
    })
    fb.setupOS2(
        sTypoAscender=800,
        sTypoDescender=-200,
        usWinAscent=800,
        usWinDescent=200,
        usWeightClass=400,
    )
    fb.setupPost(keepGlyphNames=True)
    fb.setupMaxp()
    fb.save(path)


def test_audit_and_repair_cff_otf_without_converting_outline(tmp_path: Path):
    src = tmp_path / "test.otf"
    _cff_font(src)

    audit = audit_paths([src])
    family = audit["families"][0]
    item = next(x for x in family["chars"] if x["char"] == "Ć")

    assert family["outlines"] == ["cff"]
    assert family["repair_supported"] is True
    assert item["status"] == "missing"
    assert item["repairable"] is True

    out = tmp_path / "repaired-cff"
    result = repair_paths([src], out, [item["suggested_recipe"]])
    repaired_font = TTFont(result["outputs"][0])

    assert "CFF " in repaired_font
    assert "glyf" not in repaired_font
    assert 0x0106 in repaired_font.getBestCmap()
