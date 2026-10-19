# Engine examples

Minimal projects that load a Sprite Animator ZIP export (same layout as `sample-export/`).

| Path | Engine | Loads |
|------|--------|--------|
| [`sample-export/`](./sample-export/) | — | Tiny 4-frame bounce square (atlas + Aseprite JSON + `manifest.json` + Godot `.tres`) |
| [`phaser3/`](./phaser3/) | Phaser 3 | `sprite-sheet.png` + `sprite-sheet.json` via `load.aseprite` |
| [`godot4/`](./godot4/) | Godot 4 | `animation.tres` + `frames/*.png` |

Import notes (including Unity Sprite Editor): [docs/animation/ENGINE_EXPORT.md](../docs/animation/ENGINE_EXPORT.md).

Regenerate the sample PNGs/JSON (optional):

```bash
node scripts/generate-sample-export.mjs
```
