#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
export PYTHONPATH="$ROOT/engine/src"
exec python3 -m fontbuilder_engine "$@"
