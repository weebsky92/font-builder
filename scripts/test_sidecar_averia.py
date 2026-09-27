from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/averiaseriflibre/"
FILES = [
    "AveriaSerifLibre-Light.ttf",
    "AveriaSerifLibre-LightItalic.ttf",
    "AveriaSerifLibre-Regular.ttf",
    "AveriaSerifLibre-Italic.ttf",
    "AveriaSerifLibre-Bold.ttf",
    "AveriaSerifLibre-BoldItalic.ttf",
]

engine = Path(sys.argv[1]).resolve()

with tempfile.TemporaryDirectory(prefix="averia-sidecar-") as td:
    root = Path(td)
    for name in FILES:
        urllib.request.urlretrieve(BASE + name, root / name)

    audit = subprocess.run(
        [str(engine), "glyph-audit", str(root)],
        check=False,
        capture_output=True,
    )
    print("AUDIT_RC", audit.returncode)
    print("AUDIT_STDERR", audit.stderr.decode("utf-8", errors="replace"))
    assert audit.returncode == 0, audit.stderr
    payload = json.loads(audit.stdout.decode("utf-8"))
    family = payload["families"][0]
    print("AUDIT_MISSING", family["missing_count"])
    assert family["missing_count"] > 0

    out = root / "out"
    build = subprocess.run(
        [
            str(engine), "build", str(root),
            "-o", str(out),
            "--mode", "auto",
            "--formats", "ttf,zip",
        ],
        check=False,
        capture_output=True,
    )
    print("BUILD_RC", build.returncode)
    print("BUILD_STDERR", build.stderr.decode("utf-8", errors="replace"))
    assert build.returncode == 0, build.stderr
    result = json.loads(build.stdout.decode("utf-8"))
    assert result["ok"] is True
    print("SIDECAR_AVERIA_OK")
