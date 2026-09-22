from pathlib import Path
import zipfile
from fontbuilder_engine.ingest import IngestSession

def test_zip_ignores_readme(tmp_path: Path):
    z = tmp_path / "fonts.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("README.md", "hello")
        f.writestr("__MACOSX/junk", "x")
        f.writestr("photo.png", b"x")
    with IngestSession() as s:
        found = s.collect([str(z)])
        assert found == []
        assert s.ignored
