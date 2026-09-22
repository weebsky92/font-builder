from __future__ import annotations
import copy
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
from fontTools.otlLib.builder import buildStatTable
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables._f_v_a_r import Axis, NamedInstance
from fontTools.varLib import build as varlib_build
from fontTools.varLib.featureVars import addFeatureVariations
from .model import Analysis, FontSource
from .otf import ttf_to_cff_otf


def _slug(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "", s)
    return s or "VariableFont"


def _weight_name(w: int) -> str:
    names = {100:"Thin",200:"ExtraLight",300:"Light",400:"Regular",500:"Medium",600:"SemiBold",700:"Bold",800:"ExtraBold",900:"Black"}
    return names.get(w, f"Weight {w}")


def _set_family_names(font: TTFont, family: str):
    ps = _slug(family)
    repl = {1: family, 2: "Regular", 4: family, 6: ps}
    for rec in font["name"].names:
        if rec.nameID in repl:
            try:
                rec.string = repl[rec.nameID].encode(rec.getEncoding())
            except Exception:
                pass


def _add_axes_and_instances(font: TTFont, family: str, masters: list[FontSource]):
    weights = sorted({s.weight for s in masters})
    has_roman = any(not s.italic for s in masters)
    has_italic = any(s.italic for s in masters)
    default_w = min(weights, key=lambda w: abs(w - 400))
    fvar = newTable("fvar")
    fvar.axes = []
    fvar.instances = []
    name = font["name"]

    wa = Axis(); wa.axisTag="wght"; wa.minValue=float(min(weights)); wa.defaultValue=float(default_w); wa.maxValue=float(max(weights)); wa.flags=0; wa.axisNameID=name.addName("Weight")
    fvar.axes.append(wa)
    if has_roman and has_italic:
        ia = Axis(); ia.axisTag="ital"; ia.minValue=0.0; ia.defaultValue=0.0; ia.maxValue=1.0; ia.flags=0; ia.axisNameID=name.addName("Italic")
        fvar.axes.append(ia)

    for s in masters:
        inst = NamedInstance()
        label = _weight_name(s.weight)
        if s.italic:
            label = "Italic" if s.weight == 400 else label + " Italic"
        inst.subfamilyNameID = name.addName(label)
        inst.postscriptNameID = 0xFFFF
        inst.coordinates = {"wght": float(s.weight)}
        if has_roman and has_italic:
            inst.coordinates["ital"] = 1.0 if s.italic else 0.0
        fvar.instances.append(inst)
    font["fvar"] = fvar

    stat_axes = [{
        "tag":"wght", "name":"Weight", "ordering":0,
        "values":[{"value":w, "name":_weight_name(w), **({"flags":0x2} if w==default_w else {})} for w in weights],
    }]
    if has_roman and has_italic:
        stat_axes.append({"tag":"ital", "name":"Italic", "ordering":1,
                          "values":[{"value":0,"name":"Roman","flags":0x2},{"value":1,"name":"Italic"}]})
    buildStatTable(font, stat_axes)
    return weights, has_roman, has_italic, default_w


def _norm_w(v: float, min_w: int, default_w: int, max_w: int) -> float:
    if v < default_w:
        denom = max(1, default_w - min_w)
        return (v - default_w) / denom
    denom = max(1, max_w - default_w)
    return (v - default_w) / denom


def _discrete(analysis: Analysis, out_ttf: Path) -> dict:
    masters = analysis.fonts
    default_candidates = [s for s in masters if not s.italic]
    default = min(default_candidates or masters, key=lambda s: abs(s.weight - 400))
    base = TTFont(default.path, recalcBBoxes=False)
    base_order = list(base.getGlyphOrder())
    base_set = set(base_order)

    for s in masters:
        order = TTFont(s.path).getGlyphOrder()
        if set(order) != base_set:
            raise ValueError("The current discrete builder requires the same glyph set in all masters. Analysis succeeded, but build is blocked to avoid silently dropping glyphs.")

    loaded = {}
    for s in masters:
        f = TTFont(s.path, recalcBBoxes=False)
        for g in f.getGlyphOrder():
            _ = f["glyf"][g]
        loaded[(s.italic, s.weight)] = f

    new_order = list(base_order)
    sub_maps = {}
    for s in masters:
        if s.path.resolve() == default.path.resolve():
            continue
        key = (s.italic, s.weight)
        suffix = f".vf_{'i' if s.italic else 'u'}{s.weight}"
        src = loaded[key]
        sub = {}
        for g in base_order:
            alt = g + suffix
            glyph = copy.deepcopy(src["glyf"][g])
            if glyph.isComposite():
                for comp in glyph.components:
                    if comp.glyphName in base_set:
                        comp.glyphName = comp.glyphName + suffix
            base["glyf"].glyphs[alt] = glyph
            base["hmtx"].metrics[alt] = src["hmtx"].metrics[g]
            new_order.append(alt)
            sub[g] = alt
        sub_maps[key] = sub

    base.setGlyphOrder(new_order)
    base["glyf"].glyphOrder = list(new_order)
    for tag in ("fpgm", "prep", "cvt ", "VDMX", "hdmx"):
        if tag in base:
            del base[tag]

    _set_family_names(base, analysis.family + " Variable")
    weights, has_roman, has_italic, default_w = _add_axes_and_instances(base, analysis.family + " Variable", masters)
    min_w, max_w = min(weights), max(weights)

    bounds = {}
    for i, w in enumerate(weights):
        lo = min_w if i == 0 else (weights[i-1] + w) / 2
        hi = max_w if i == len(weights)-1 else (w + weights[i+1]) / 2
        lo_n = _norm_w(lo, min_w, default_w, max_w) + (0.0001 if i else 0)
        hi_n = _norm_w(hi, min_w, default_w, max_w) - (0.0001 if i != len(weights)-1 else 0)
        bounds[w] = (lo_n, hi_n)

    conditional = []
    for s in masters:
        if s.path.resolve() == default.path.resolve():
            continue
        box = {"wght": bounds[s.weight]}
        if has_roman and has_italic:
            box["ital"] = (0.5, 1.0) if s.italic else (0.0, 0.4999)
        conditional.append(([box], sub_maps[(s.italic, s.weight)]))
    if conditional:
        addFeatureVariations(base, conditional, featureTag="rvrn")

    base["OS/2"].usWeightClass = default_w
    base["OS/2"].fsSelection &= ~0x01
    base["head"].macStyle &= ~0x02
    base.save(out_ttf, reorderTables=True)
    return {"mode":"discrete-variable", "default_weight":default_w, "weights":weights, "has_italic":has_roman and has_italic}


def _true_variable(analysis: Analysis, out_ttf: Path) -> dict:
    masters = analysis.fonts
    weights = sorted({s.weight for s in masters})
    has_roman = any(not s.italic for s in masters)
    has_italic = any(s.italic for s in masters)
    default_w = min(weights, key=lambda w: abs(w - 400))
    with tempfile.TemporaryDirectory(prefix="fontbuilder-ds-") as td:
        ds = DesignSpaceDocument()
        ax = AxisDescriptor(); ax.name="Weight"; ax.tag="wght"; ax.minimum=min(weights); ax.default=default_w; ax.maximum=max(weights); ds.addAxis(ax)
        if has_roman and has_italic:
            ia = AxisDescriptor(); ia.name="Italic"; ia.tag="ital"; ia.minimum=0; ia.default=0; ia.maximum=1; ds.addAxis(ia)
        default_src = min([s for s in masters if not s.italic] or masters, key=lambda s: abs(s.weight-default_w))
        for s in masters:
            sd = SourceDescriptor(); sd.path=str(s.path); sd.name=f"{s.weight}-{'i' if s.italic else 'r'}"; sd.familyName=analysis.family; sd.styleName=s.subfamily
            sd.location={"Weight":s.weight}
            if has_roman and has_italic: sd.location["Italic"] = 1 if s.italic else 0
            if s.path.resolve()==default_src.path.resolve():
                sd.copyInfo=True; sd.copyLib=True; sd.copyGroups=True; sd.copyFeatures=True
            ds.addSource(sd)
        ds_path=Path(td)/"build.designspace"; ds.write(ds_path)
        vf, _, _ = varlib_build(str(ds_path))
        _set_family_names(vf, analysis.family + " Variable")
        vf.save(out_ttf)
    return {"mode":"true-variable", "default_weight":default_w, "weights":weights, "has_italic":has_roman and has_italic}


def build_family(analysis: Analysis, output_dir: Path, mode: str="auto", formats: list[str]|None=None) -> dict:
    formats = formats or ["ttf","otf","woff","woff2","css","zip"]
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = _slug(analysis.family) + "-Variable"
    ttf = output_dir / f"{stem}.ttf"
    selected = analysis.build_mode if mode == "auto" else mode
    warnings = list(analysis.warnings)
    if selected == "true-variable":
        try:
            meta = _true_variable(analysis, ttf)
        except Exception as exc:
            if mode != "auto":
                raise
            warnings.append(f"True variable build failed; AUTO fell back to discrete mode: {exc}")
            meta = _discrete(analysis, ttf)
    elif selected == "discrete-variable":
        meta = _discrete(analysis, ttf)
    else:
        raise ValueError(f"Unsupported build mode: {selected}")

    produced = []
    if "ttf" in formats:
        produced.append(ttf)

    otf = output_dir / f"{stem}.otf"
    if "otf" in formats:
        ttf_to_cff_otf(ttf, otf)
        produced.append(otf)

    for fmt in ("woff", "woff2"):
        if fmt in formats:
            f = TTFont(ttf); f.flavor=fmt; p=output_dir/f"{stem}.{fmt}"; f.save(p); produced.append(p)

    css_path = output_dir / f"{stem}.css"
    if "css" in formats:
        axes = TTFont(ttf)["fvar"].axes
        w = next(a for a in axes if a.axisTag=="wght")
        has_ital = any(a.axisTag=="ital" for a in axes)
        style = "normal italic" if has_ital else "normal"
        css = f"""@font-face {{\n  font-family: '{analysis.family} Variable';\n  src: url('{stem}.woff2') format('woff2-variations'),\n       url('{stem}.woff') format('woff-variations'),\n       url('{stem}.ttf') format('truetype-variations');\n  font-style: {style};\n  font-weight: {int(w.minValue)} {int(w.maxValue)};\n  font-display: swap;\n}}\n"""
        css_path.write_text(css, encoding="utf-8"); produced.append(css_path)

    validation = {}
    for p in produced:
        if p.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}:
            f = TTFont(p)
            validation[p.name] = {
                "glyphs": len(f.getGlyphOrder()),
                "axes": [{"tag":a.axisTag,"min":a.minValue,"default":a.defaultValue,"max":a.maxValue} for a in f["fvar"].axes],
                "instances": len(f["fvar"].instances),
                "feature_variations": bool(getattr(f.get("GSUB").table, "FeatureVariations", None)) if "GSUB" in f else False,
                "outline": "CFF" if "CFF " in f else "CFF2" if "CFF2" in f else "glyf" if "glyf" in f else "unknown",
            }

    report = {
        "family": analysis.family,
        "mode": meta["mode"],
        "weights": meta["weights"],
        "warnings": warnings,
        "produced": [str(p) for p in produced],
        "validation": validation,
    }
    report_path = output_dir / "build-report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    produced.append(report_path)

    if "zip" in formats:
        zip_path = output_dir / f"{stem}-Pack.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for p in produced:
                z.write(p, arcname=p.name)
        report["zip"] = str(zip_path)
    return report
