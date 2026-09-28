from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from fontbuilder_engine.font_tools import inspect_tools, update_metadata, convert_formats


def _rect():
    pen = TTGlyphPen(None)
    pen.moveTo((50, 0))
    pen.lineTo((550, 0))
    pen.lineTo((550, 700))
    pen.lineTo((50, 700))
    pen.closePath()
    return pen.glyph()


def _font(path: Path):
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder([".notdef", "A"])
    fb.setupCharacterMap({0x0041: "A"})
    fb.setupGlyf({".notdef": _rect(), "A": _rect()})
    fb.setupHorizontalMetrics({".notdef": (600, 0), "A": (600, 0)})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        "familyName": "ToolsTest",
        "styleName": "Regular",
        "fullName": "ToolsTest Regular",
        "psName": "ToolsTest-Regular",
        "version": "Version 1.0",
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


def test_font_tools_inspect_metadata_and_conversion(tmp_path: Path):
    src = tmp_path / "tools.ttf"
    _font(src)

    tools_out = tmp_path / "tools-out"
    report = inspect_tools([src], tools_out)
    assert report["fonts"][0]["family"] == "ToolsTest"
    assert report["fonts"][0]["characters"][0]["unicode"] == "U+0041"
    assert Path(report["fonts"][0]["preview_path"]).exists()

    meta_out = tmp_path / "meta"
    edited = update_metadata([src], meta_out, 0, {
        "family": "Renamed Family",
        "style": "Book",
        "full_name": "Renamed Family Book",
        "postscript": "RenamedFamily-Book",
        "version": "Version 2.5",
    })
    changed = TTFont(edited["output"])
    assert changed["name"].getName(1, 3, 1, 0x409).toUnicode() == "Renamed Family"
    assert changed["name"].getName(6, 3, 1, 0x409).toUnicode() == "RenamedFamily-Book"

    conv_out = tmp_path / "convert"
    converted = convert_formats([src], conv_out, ["woff", "woff2"])
    assert len(converted["outputs"]) == 2
    assert Path(converted["zip"]).exists()
