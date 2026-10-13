# Changelog

Versions follow [semver](https://semver.org): MAJOR for breaking output or skill changes, MINOR for new capabilities, PATCH for fixes. The version lives in `.claude-plugin/plugin.json` and is written into every `*.provenance.json` (`kit.version`), so any world can be traced to the exact kit that built it.

## 0.1.1 (2026-10-13)
- Build into any folder: `OUT=<dir> Tools/kit/street.sh …` (e.g. a gamerplex-dev game with a live preview).
- Skill finds the kit through symlinks and reports the right place to play the result.
- CC0 downloads retry with backoff when a host drops the connection.
- Provenance records the kit version.

## 0.1.0 (2026-10-13)
- First release: street generator (dense neon mode), 33 CC0 facade and prop modules, sign textures, CC0 material fetcher (ambientCG), licence gate, provenance + LICENSE per build, web walkthrough, Claude Code plugin with the `build-street` skill.
