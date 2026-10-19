# Engine export formats

Sprite Animator ZIP downloads (`sprite-export.zip`) can include engine-oriented metadata next to PNG frames.

## Contents

| File | Role |
|------|------|
| `frames/frame_XXX.png` | Individual frames |
| `sprite-sheet.png` | Packed atlas |
| `sprite-sheet.json` | Aseprite json-array (+ `frameTags`) |
| `manifest.json` | Compact cols/rows/fps/loop summary |
| `animation.tres` | Godot 4 `SpriteFrames` resource |

## Phaser

```js
this.load.aseprite('hero', 'sprite-sheet.png', 'sprite-sheet.json');
this.anims.createFromAseprite('hero');
```

`meta.frameTags[0].name` defaults to `"default"`.

## Godot 4

1. Unpack the ZIP into your project (e.g. `res://sprites/hero/`).
2. Keep `animation.tres` next to the `frames/` folder (paths are `res://frames/frame_XXX.png` relative to the `.tres` location — if you nest the folder, open the `.tres` and fix `ext_resource` paths, or move `frames/` to match).
3. In the FileSystem dock, double-click `animation.tres` (type `SpriteFrames`).
4. Assign it to an `AnimatedSprite2D` → **Sprite Frames**.

The animation name is `default`; `speed` is FPS from the export playback setting.

Minimal import without the `.tres`: create an `AnimatedSprite2D`, make a new SpriteFrames resource, and drag `frames/*.png` into a clip at the same FPS shown in `manifest.json`.

## Custom engines

Prefer `manifest.json` for a stable small schema (`schemaVersion: 1`). Use `sprite-sheet.json` when you already have an Aseprite/Phaser atlas pipeline.
