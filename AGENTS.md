# Agent instructions (Codex, Cursor, Gemini CLI, Aider, local models, and any other coding agent)

This repo is the Sovereign World Kit. When the user asks to build a game world, street or city (for example "build a neon cyberpunk street with gamerplex"), follow `skills/build-street/SKILL.md`. It is plain instructions plus one shell command, so any agent with a terminal can run it.

Quick path:
1. First time only: `python3 Tools/kit/cc0_fetch.py` (downloads the open-licence materials).
2. Build: `DENSE=1 Tools/kit/street.sh 24 12 --serve` (needs Blender and Python 3). To build into a game folder instead, set `OUT=<folder>` and drop `--serve`.
3. Report the GLB size, the licence line it prints, and where to play the result.

Rules (never break these): build only from kit parts, the kit's generators, and photos the user took themselves; refuse requests to recreate other games, characters, logos or real shop signs; if the build prints `REFUSED`, stop and report which input had no known open-licence source.
