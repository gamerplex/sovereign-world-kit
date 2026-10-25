# Changelog

Versions follow [semver](https://semver.org): MAJOR for breaking output or skill changes, MINOR for new capabilities, PATCH for fixes. The version lives in `.claude-plugin/plugin.json` and is written into every `*.provenance.json` (`kit.version`), so any world can be traced to the exact kit that built it.

## 0.2.0 (2026-10-25)
- The random city comes populated, all from code (no assets, CC0 output): `RobotGenerator` (drone, hound, heavy; red, violet, gold or cyan; animated patrols), `BorderGateGenerator` (a checkpoint where a road crosses a district line; open / scan / closed), `ObjectiveSiteGenerator` (power station, datacentre, drone hive; dark to relit, on lots cleared for them). `?bare` shows the city alone.
- Random city generator in the browser (`three/city.html`): official three.js CityGenerator + Cyberfier, nothing to install. CC0 output; no map data, no embedded assets.
- `build-city` skill; the page downloads its provenance record (generator, versions, seed, Cyberfier hash).
- Real-city mode (open map data, ODbL credit) is planned, not included.

## 0.1.1 (2026-10-13)
- Build into any folder: `OUT=<dir> Tools/kit/street.sh …` (e.g. a gamerplex-dev game with a live preview).
- Skill finds the kit through symlinks and reports the right place to play the result.
- CC0 downloads retry with backoff when a host drops the connection.
- Provenance records the kit version.

## 0.1.0 (2026-10-13)
- First release: street generator (dense neon mode), 33 CC0 facade and prop modules, sign textures, CC0 material fetcher (ambientCG), licence gate, provenance + LICENSE per build, web walkthrough, Claude Code plugin with the `build-street` skill.
