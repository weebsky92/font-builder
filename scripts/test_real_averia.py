from __future__ import annotations

import json
import tempfile
import traceback
import urllib.request
from pathlib import Path

from fontbuilder_engine.builder import build_family
from fontbuilder_engine.glyphlab import audit_paths, repair_paths
from fontbuilder_engine.inspect import group_fonts, analyze_family

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/averiaseriflibre/"
FILES = [
    "AveriaSerifLibre-Light.ttf",
    "AveriaSerifLibre-LightItalic.ttf",
    "AveriaSerifLibre-Regular.ttf",
    "AveriaSerifLibre-Italic.ttf",
    "AveriaSerifLibre-Bold.ttf",
    "AveriaSerifLibre-BoldItalic.ttf",
]

with tempfile.TemporaryDirectory(prefix="averia-real-") as td:
    root = Path(td)
    paths = []
    for name in FILES:
        path = root / name
        urllib.request.urlretrieve(BASE + name, path)
        paths.append(path)

    print("DOWNLOADED", [p.name for p in paths])

    try:
        audit = audit_paths(paths)
        print("AUDIT_OK", audit["families"][0]["missing_count"], "missing")
    except Exception:
        print("AUDIT_FAIL")
        traceback.print_exc()
        raise

    try:
        family_audit = audit["families"][0]
        missing = [item for item in family_audit["chars"] if item["status"] != "present"]
        recipes = [item["suggested_recipe"] for item in missing]
        repair_dir = root / "repair"
        repaired = repair_paths(paths, repair_dir, recipes)
        assert repaired["variant_count"] == len(FILES), repaired
        assert Path(repaired["zip"]).exists(), repaired
        assert len(repaired["outputs"]) == len(FILES), repaired

        repaired_audit = audit_paths([Path(path) for path in repaired["outputs"]])
        assert repaired_audit["families"][0]["complete"] is True, repaired_audit
        print("REPAIR_OK", repaired["variant_count"], "variants", repaired["zip"])
    except Exception:
        print("REPAIR_FAIL")
        traceback.print_exc()
        raise

    groups = group_fonts(paths)
    family_name, sources = next(iter(groups.items()))
    analysis = analyze_family(family_name, sources)
    print("ANALYSIS", json.dumps(analysis.json(), ensure_ascii=True))

    out = root / "build"
    try:
        result = build_family(
            analysis,
            out,
            mode="auto",
            formats=["ttf", "zip"],
        )
        print("BUILD_OK", result)
    except Exception:
        print("BUILD_FAIL")
        traceback.print_exc()
        raise
