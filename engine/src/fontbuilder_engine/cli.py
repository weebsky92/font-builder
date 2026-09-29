from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .builder import build_family
from .glyphlab import audit_paths, preview_path, repair_paths
from .ingest import IngestSession
from .inspect import group_fonts, analyze_family
from .font_tools import inspect_tools, update_metadata, convert_formats


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fontbuilder-engine")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze")
    a.add_argument("inputs", nargs="+")

    b = sub.add_parser("build")
    b.add_argument("inputs", nargs="+")
    b.add_argument("-o", "--output", required=True)
    b.add_argument("--mode", choices=["auto", "true-variable", "discrete-variable"], default="auto")
    b.add_argument("--formats", default="ttf,otf,woff,woff2,css,zip")

    ga = sub.add_parser("glyph-audit")
    ga.add_argument("inputs", nargs="+")

    gp = sub.add_parser("glyph-preview")
    gp.add_argument("--char", required=True)
    gp.add_argument("--recipe-json")
    gp.add_argument("--profile", choices=["roman", "italic"], default="roman")
    gp.add_argument("inputs", nargs="+")

    gr = sub.add_parser("glyph-repair")
    gr.add_argument("-o", "--output", required=True)
    gr.add_argument("--recipes-json", required=True)
    gr.add_argument("inputs", nargs="+")

    ft = sub.add_parser("font-tools")
    ft.add_argument("-o", "--output", required=True)
    ft.add_argument("inputs", nargs="+")

    fm = sub.add_parser("metadata-update")
    fm.add_argument("-o", "--output", required=True)
    fm.add_argument("--index", type=int, required=True)
    fm.add_argument("--metadata-json", required=True)
    fm.add_argument("inputs", nargs="+")

    fc = sub.add_parser("convert")
    fc.add_argument("-o", "--output", required=True)
    fc.add_argument("--formats", default="woff,woff2")
    fc.add_argument("inputs", nargs="+")

    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        with IngestSession() as session:
            paths = session.collect(args.inputs)

            if args.cmd == "font-tools":
                payload = {
                    "ok": True,
                    "version": __version__,
                    "tools": inspect_tools(paths, Path(args.output).resolve()),
                    "ignored": session.ignored,
                }

            elif args.cmd == "metadata-update":
                metadata = json.loads(args.metadata_json)
                payload = {
                    "ok": True,
                    "version": __version__,
                    "result": update_metadata(
                        paths,
                        Path(args.output).resolve(),
                        args.index,
                        metadata,
                    ),
                    "ignored": session.ignored,
                }

            elif args.cmd == "convert":
                formats = [x.strip().lower() for x in args.formats.split(",") if x.strip()]
                payload = {
                    "ok": True,
                    "version": __version__,
                    "result": convert_formats(paths, Path(args.output).resolve(), formats),
                    "ignored": session.ignored,
                }

            elif args.cmd == "glyph-audit":
                payload = {
                    "ok": True,
                    "version": __version__,
                    **audit_paths(paths),
                    "ignored": session.ignored,
                }

            elif args.cmd == "glyph-preview":
                recipe = json.loads(args.recipe_json) if args.recipe_json else None
                payload = {
                    "ok": True,
                    "version": __version__,
                    "preview": preview_path(paths, args.char, recipe, args.profile),
                }

            elif args.cmd == "glyph-repair":
                recipes = json.loads(args.recipes_json)
                payload = {
                    "ok": True,
                    "version": __version__,
                    "result": repair_paths(paths, Path(args.output).resolve(), recipes),
                    "ignored": session.ignored,
                }

            else:
                groups = group_fonts(paths)
                analyses = [analyze_family(name, fonts) for name, fonts in groups.items()]

                if args.cmd == "analyze":
                    payload = {
                        "ok": True,
                        "version": __version__,
                        "families": [a.json() for a in analyses],
                        "ignored": session.ignored,
                    }
                else:
                    out = Path(args.output).resolve()
                    out.mkdir(parents=True, exist_ok=True)
                    results = []
                    formats = [x.strip().lower() for x in args.formats.split(",") if x.strip()]
                    for a in analyses:
                        family_out = out / (a.family.replace("/", "-") or "font")
                        results.append(build_family(a, family_out, args.mode, formats))
                    payload = {
                        "ok": True,
                        "version": __version__,
                        "results": results,
                        "ignored": session.ignored,
                    }

            print(json.dumps(payload, indent=2, ensure_ascii=True))
            return 0

    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
