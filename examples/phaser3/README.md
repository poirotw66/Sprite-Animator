# Phaser 3 example

Loads `../sample-export/sprite-sheet.png` + `sprite-sheet.json` with Phaser’s Aseprite loader.

## Run

From the repository root (any static server that can serve `examples/`):

```bash
npx --yes serve examples -p 4177
```

Open [http://localhost:4177/phaser3/](http://localhost:4177/phaser3/).

Phaser is loaded from a CDN ESM build — no `npm install` inside this folder.

## Swap in your export

1. Download **ZIP** from Sprite Animator.
2. Unpack over `examples/sample-export/` (or point `main.js` `load.aseprite` paths at your folder).
3. Reload the page. Animation tag name defaults to `default`.
