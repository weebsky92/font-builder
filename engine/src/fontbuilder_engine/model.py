from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

@dataclass
class FontSource:
    path: Path
    family: str
    subfamily: str
    postscript_name: str
    weight: int
    italic: bool
    outline: str
    glyph_count: int
    upm: int

    def json(self) -> dict[str, Any]:
        d = asdict(self)
        d["path"] = str(self.path)
        return d

@dataclass
class Analysis:
    family: str
    fonts: list[FontSource]
    compatible: bool
    same_glyph_order: bool
    common_glyphs: int
    topology_mismatches: int
    build_mode: str
    warnings: list[str]

    def json(self) -> dict[str, Any]:
        return {
            "family": self.family,
            "fonts": [f.json() for f in self.fonts],
            "compatible": self.compatible,
            "same_glyph_order": self.same_glyph_order,
            "common_glyphs": self.common_glyphs,
            "topology_mismatches": self.topology_mismatches,
            "build_mode": self.build_mode,
            "warnings": self.warnings,
        }
