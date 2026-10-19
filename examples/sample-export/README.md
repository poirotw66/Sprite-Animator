# Sample export

Hand-sized stand-in for a Sprite Animator **ZIP** download (4×32×32 frames, 8 FPS).

| File | Role |
|------|------|
| `frames/frame_XXX.png` | Individual frames |
| `sprite-sheet.png` | Packed atlas (4×1) |
| `sprite-sheet.json` | Aseprite json-array + `frameTags` |
| `manifest.json` | Compact cols/rows/fps summary |
| `animation.tres` | Godot 4 `SpriteFrames` |

Used by [`../phaser3/`](../phaser3/) and mirrored into [`../godot4/`](../godot4/) for a self-contained Godot project.
