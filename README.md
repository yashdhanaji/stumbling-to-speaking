# From Stumbling to Speaking

A Game Boy-style top-down adventure about learning to speak with confidence at Toastmasters.
Walk around, talk to people (A), and play short action mini-games. No menus, no multiple choice.

**Play:** open `index.html` in a browser (works straight from the file, no server or build).

| | Keyboard | Touch |
|---|---|---|
| Walk | Arrows / WASD | on-screen D-pad |
| Talk, use, confirm | Z / Space | A |
| Skip text | Enter | Start |
| New game (on the title screen, if a save exists) | Shift | Select |
| Mute | M | |

Follow the `!` marker. Your Confidence bar (top-left) grows with every mini-game; it decides the ending of the final scene.

## For developers
- `node check.mjs` runs every check: maps, story text, all seven mini-games with perfect and idle bots, and full playthroughs (a perfect player reaches the Confident ending, a hopeless one the Still-growing ending; nobody gets stuck).
- `tests/play.html` runs the same bots in a real browser (serve the folder over HTTP; it POSTs a report to `/report`).
- `src/gfx.js` renders into a 160x144 framebuffer where every pixel has a shade (0-3) and a palette id, Game Boy Color style (about 50 four-colour palettes: per-room floors, per-person skin/hair/shirt, a different colour for each Pathways door and mini-game). It renders the same in Node (`tools/png.mjs` writes coloured screenshots).
- The old choice-menu 3D version is tagged `v1-3d-choice`.
