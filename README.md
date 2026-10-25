# Sovereign World Kit

**Build anything you're allowed to.** An open, agent-native kit for original 3D worlds. Every part is CC0, every output ships with a licence and a provenance record, and your agent refuses to rebuild other people's games. Web + Unreal. Built with Gamerplex.

![A city and a walkable street built from the kit, with its provenance record](demo.gif)

## Install (Claude Code)
```
/plugin marketplace add gamerplex/sovereign-world-kit
/plugin install sovereign-world-kit@gamerplex
```
Then ask: **"build a rainy night street with Gamerplex, 24 bays"** or **"build me a random cyberpunk city"**.

No Blender? Random city, in the browser, nothing to install: `python3 -m http.server 8822` then open `http://localhost:8822/three/city.html?seed=94` (three.js; WASD + drag to fly; the page can download its provenance record). The city comes with robot patrols, a checkpoint gate and three objective sites (power station, datacentre, drone hive); add `&bare` for the city alone.

Or clone and run it yourself (needs [Blender](https://www.blender.org/) 4.x and Python 3):
```bash
git clone https://github.com/gamerplex/sovereign-world-kit && cd sovereign-world-kit
python3 Tools/kit/cc0_fetch.py          # once: CC0 materials from ambientCG
Tools/kit/street.sh 24 12 --serve       # build a 24-bay street (seed 12) and open http://localhost:8765
```
Blender somewhere else? `BLENDER=/path/to/blender Tools/kit/street.sh …` · Neon-canyon street (stacked signs, skybridges): `DENSE=1 Tools/kit/street.sh 24 12 --serve`

## What you get
- `Saved/web/street.glb`: the street (two sides, shopfronts, upper floors, blade signs, lamps, road and sidewalks), Draco-compressed, ~9 MB at 16 bays. Loads in any glTF engine (three.js, Godot, Blender, Unreal).
- `Saved/web/street.provenance.json`: every input's file, SHA-256, source and licence, plus the generator version and settings. **The build refuses if any input has no known CC0 origin.**
- `Saved/web/LICENSE`: CC0 1.0 for the generated scene.
- `Saved/web/index.html`: a walkthrough (WASD + mouse; on phones drag to look and hold ▲).

## What's inside
| Path | What |
|---|---|
| `three/` | random city generator: official three.js `CityGenerator` + `Cyberfier` (CC0 output) |
| `three/RobotGenerator.js` · `BorderGateGenerator.js` · `ObjectiveSiteGenerator.js` | robots (drone, hound, heavy), checkpoint gates, objective sites; all from code, placed in the random city |
| `skills/build-city/` | the agent skill for random cities |
| `skills/build-street/` | the agent skill (also linked at `.claude/skills/` for cloned use) |
| `Tools/blender/kit/` | the generators: `facades.py` (module set), `street.py` (assembly), `street_build.py` (GLB + provenance gate) |
| `Imports/kit/` | the CC0 facade modules and sign atlases our generators made |
| `Tools/kit/cc0_fetch.py` | fetches the exact ambientCG sets the generator uses, each with a `source.json` record |
| `Tools/kit/web/` | the three.js walkthrough |

### The pipeline
Everything a 3D game needs, built the same way: open licence in, provenance out.

| Pipeline | Status | In this repo |
|---|---|---|
| Street generator: neon, dense or plain, any length | v0.1 live | ✓ |
| Licence gate + provenance record for every build | v0.1 live | ✓ |
| City generator: random city from a seed, in three.js (CC0) | v0.2 live | ✓ |
| Unreal import: kit modules as native Unreal meshes | v0.1 live | soon |
| Asset forge: photo or text → 3D prop, with provenance | v0.1 live | soon |
| Vehicle generator | v0.1 live | soon |
| Music generation (CC0 output) | v0.1 live | soon |
| More buildings and props (CC0, audited before release) | Building | |
| Character generator: original rigged humans and crowds | Next | |
| Animation and locomotion set | Next | |
| Sound effects | Next | |
| Gameplay pack: third-person controller, combat, AI opponents | Next | |
| Unreal plugin, then Godot | Next | |
| One-click publish: hosting, challenge link, sign in with Flipcash | Next | |
| Proof of creation on Solana + maker payouts | Next | |

## Licensed by construction
- **In:** this kit's own generator output, CC0 materials (ambientCG), and photos you took yourself.
- **Refused:** other games' files or screenshots, known characters, brand logos and trademarks.
- **Out:** CC0 1.0 + a provenance record. Pure AI or procedural output generally isn't copyrightable (US Copyright Office, 2025), so CC0 is the honest default; what you design on top is yours.

## Publish and get paid (Solana)
The kit is free and works on its own. When you want players and revenue, publish to the [Gamerplex arcade](https://gamerplex.com): it's live on Solana mainnet, players pay a few cents per play, and players can sign in with [Flipcash](https://flipcash.com) and bring their community. The payment side lives in its own open repos: [gamerplex-arcade](https://github.com/gamerplex/gamerplex-arcade) (contracts) and [gamerplex-sdk](https://github.com/gamerplex/gamerplex-sdk). Next: every world's provenance anchored on Solana, so the people who made its parts can be paid when it's played.

## Roadmap
Next: **random cities from a seed are CC0 and live (v0.2).** "Build my hometown" from open map data is a separate mode that carries ODbL map credit in its provenance record. Then a small CC0 gameplay pack and one-click publishing to the Gamerplex arcade. Unreal and Godot come after. See *The pipeline* above.

## Licence
Assets: CC0 1.0 (`LICENSE-ASSETS`). Code: MIT (`LICENSE`). Not legal advice: see `LEGAL.md`.
