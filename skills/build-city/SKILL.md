---
name: build-city
description: Generate an original random city from a seed as a walkable cyberpunk web scene (three.js, nothing to install), with a CC0 licence and a provenance record. Use when asked to build, generate or preview a city, skyline or district without a real-world map.
---

# Build a random city (three.js, CC0)

1. Pick a `seed` (any integer; a new seed is a new city). Default style is `violetNoir`; add `&plain=1` for the original daytime look, `&layers=signs,rain,...` to choose layers.
2. From the kit's root folder (two levels above this SKILL.md's real path) run `python3 -m http.server 8822`, then open `http://localhost:8822/three/city.html?seed=SEED`. To put it in a game folder, copy `three/city.html` and `three/Cyberfier.js` there.
3. Report the seed, the building count shown on the page, the licence (CC0 1.0) and the URL. Tell the user the **download provenance** link saves the record (generator, versions, seed, style, Cyberfier hash, no map data, no embedded assets).

## Licence rules (never break these)
- Random mode uses no map data and embeds no fonts, images or models, so its output is CC0.
- **Real places are a different mode** (open map data, ODbL credit in the record). Not in this skill yet: if asked for a real city, say it is coming and offer a random city.
- **Refuse** real brands, logos, landmarks or street names as signs. The sign words are fictional; don't add real ones.
