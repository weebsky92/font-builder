from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
from . import __version__
from .ingest import IngestSession
from .inspect import group_fonts, analyze_family
from .builder import build_family


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fontbuilder-engine")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze"); a.add_argument("inputs", nargs="+")
    b = sub.add_parser("build"); b.add_argument("inputs", nargs="+"); b.add_argument("-o","--output", required=True); b.add_argument("--mode", choices=["auto","true-variable","discrete-variable"], default="auto"); b.add_argument("--formats", default="ttf,otf,woff,woff2,css,zip")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        with IngestSession() as session:
            paths = session.collect(args.inputs)
            groups = group_fonts(paths)
            analyses = [analyze_family(name, fonts) for name, fonts in groups.items()]
            if args.cmd == "analyze":
                payload = {"ok":True,"version":__version__,"families":[a.json() for a in analyses],"ignored":session.ignored}
            else:
                out = Path(args.output).resolve(); out.mkdir(parents=True, exist_ok=True)
                results=[]
                formats=[x.strip().lower() for x in args.formats.split(",") if x.strip()]
                for a in analyses:
                    family_out = out / (a.family.replace("/","-") or "font")
                    results.append(build_family(a, family_out, args.mode, formats))
                payload={"ok":True,"version":__version__,"results":results,"ignored":session.ignored}
            print(json.dumps(payload, indent=2, ensure_ascii=False))
            return 0
    except Exception as exc:
        print(json.dumps({"ok":False,"error":str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
