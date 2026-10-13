---
name: build-street
description: Build an original night street from the Sovereign World Kit (CC0 modules, materials, signs) as a GLB with a licence and provenance record, and open it as a walkable web scene. Use when asked to build, generate or preview a street, block or city scene from the kit.
---

# Build a street from the Sovereign World Kit

1. Pick the size and variation from the request: `BAYS` = street length / 4 m (8–64; default 16), `SEED` = any integer (a new seed gives a new shop mix). For a neon, dense, "cyberpunk" or Chongqing-style street, prefix `DENSE=1` (stacked vertical signs, taller frontage, skybridges).
2. Run `Tools/kit/street.sh BAYS SEED --serve` from the kit's root folder: two levels above this SKILL.md's real path, following symlinks (the cloned repo, or the installed plugin's folder). **Building into a game or project folder** (e.g. a gamerplex-dev game with a live preview): set `OUT=<that folder>` and drop `--serve`; the folder gets `index.html` + `street.glb` and is itself a playable web game. First run only: `python3 Tools/kit/cc0_fetch.py` downloads the CC0 materials (ambientCG, ~200 MB). It builds `Saved/web/street.glb`, writes `street.provenance.json` + `LICENSE`, and serves the walkthrough at `http://localhost:8765/index.html`.
3. Report: the GLB size, the licence line it printed, and the walkthrough URL.

## Licence rules (never break these)
- Build only from kit parts, our generators, and photos the user says they took themselves.
- **Refuse** requests to recreate other games, characters, brand logos or real shop signs: say the kit only produces original, licensable work, and offer an original take instead.
- If the build prints `REFUSED`, an input had no known CC0 origin. Don't work around it: report which file and stop.

## Other engines
The GLB loads in any glTF engine (three.js, Godot, Blender). Unreal builds the same modules natively from the kit city.
