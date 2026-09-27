from __future__ import annotations

from fontTools.otlLib.maxContextCalc import maxCtxFont


def prepare_font_for_save(font):
    """Hydrate optional legacy OpenType fields that FontTools may require on save.

    Some older fonts declare a newer OS/2 table version while omitting fields
    introduced by that version. They can render in Windows but fail when a
    modern editor recompiles the table. Existing values are never overwritten.
    """
    os2 = font.get("OS/2")
    if os2 is None:
        return font

    version = int(getattr(os2, "version", 0) or 0)

    if version >= 1:
        if not hasattr(os2, "ulCodePageRange1"):
            os2.ulCodePageRange1 = 0
        if not hasattr(os2, "ulCodePageRange2"):
            os2.ulCodePageRange2 = 0

    if version >= 2:
        defaults = {
            "sxHeight": 0,
            "sCapHeight": 0,
            "usDefaultChar": 0,
            "usBreakChar": 32,
        }
        for name, value in defaults.items():
            if not hasattr(os2, name):
                setattr(os2, name, value)

        if not hasattr(os2, "usMaxContext"):
            try:
                os2.usMaxContext = int(maxCtxFont(font))
            except Exception:
                os2.usMaxContext = 0

    if version >= 5:
        if not hasattr(os2, "usLowerOpticalPointSize"):
            os2.usLowerOpticalPointSize = 0
        if not hasattr(os2, "usUpperOpticalPointSize"):
            os2.usUpperOpticalPointSize = 0xFFFF

    return font
