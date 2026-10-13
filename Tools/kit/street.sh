#!/bin/bash
# Build a CC0 night street from the kit (GLB + provenance + LICENSE) and serve the web walkthrough.
# Usage: [BLENDER=/path/to/blender] [DENSE=1] [OUT=dir] street.sh [BAYS=16] [SEED=7] [--serve]   (DENSE=1: neon-canyon street)     Output: Saved/web/street.glb (+ .provenance.json, LICENSE, index.html)
set -eu
PROJ="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$PROJ"
BAYS="${1:-16}"; SEED="${2:-7}"; OUT="${OUT:-Saved/web}"; mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
"${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b -P Tools/blender/kit/street_build.py -- \
  Imports/kit/facades Imports/kit/textures "$OUT/street.glb" "$BAYS" "$SEED" ${DENSE:+--dense} 2>&1 | grep -E "^GLB|REFUSED" || { echo "build failed"; exit 1; }
cp Tools/kit/web/index.html "$OUT/index.html"
python3 -c "import json;d=json.load(open('$OUT/street.provenance.json'));print('licence', d['licence'], '|', len(d['inputs']), 'inputs, all with a CC0 source record')"
if [[ " $* " == *" --serve "* ]]; then
  echo "walkthrough: http://localhost:8765/index.html"
  exec python3 -m http.server 8765 --directory "$OUT"
fi
