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

Runnable sample: [`examples/phaser3/`](../../examples/phaser3/) (uses [`examples/sample-export/`](../../examples/sample-export/)).

## Godot 4

1. Unpack the ZIP into your project (e.g. `res://sprites/hero/`).
2. Keep `animation.tres` next to the `frames/` folder (paths are `res://frames/frame_XXX.png` relative to the `.tres` location — if you nest the folder, open the `.tres` and fix `ext_resource` paths, or move `frames/` to match).
3. In the FileSystem dock, double-click `animation.tres` (type `SpriteFrames`).
4. Assign it to an `AnimatedSprite2D` → **Sprite Frames**.

The animation name is `default`; `speed` is FPS from the export playback setting.

Minimal import without the `.tres`: create an `AnimatedSprite2D`, make a new SpriteFrames resource, and drag `frames/*.png` into a clip at the same FPS shown in `manifest.json`.

Runnable sample: [`examples/godot4/`](../../examples/godot4/).

## Unity (Sprite Editor)

Unity does not ship a first-party Aseprite JSON importer. The cheapest path uses **`manifest.json`** + the atlas (or individual frames).

### Option A — Grid slice the atlas (recommended)

1. Import `sprite-sheet.png` into your Unity project (Texture Type: **Sprite (2D and UI)**).
2. Open the texture in the **Sprite Editor**.
3. Set **Sprite Mode** → **Multiple**, then **Slice** → **Grid By Cell Size** (or Grid By Cell Count):
   - Cell size = `manifest.json` → `frameWidth` × `frameHeight`
   - Or cell count = `cols` × `rows` (ignore empty trailing cells if `cols * rows > frameCount`)
4. Apply. Create an **Animator** / Animation clip that sequences the sliced sprites at `fps` (and loop if `loop` is true).

You can also skip the atlas and drag `frames/frame_XXX.png` into a clip in order — no slicing required.

### Option B — TexturePacker-style JSON (optional)

Sprite Animator does **not** emit TexturePacker JSON today. If your pipeline already expects TexturePacker **JSON Array** / Hash:

- Prefer writing a small converter from `sprite-sheet.json` (Aseprite json-array: `frames[].frame.{x,y,w,h}` + `meta.size`) into TexturePacker shape, **or**
- Keep using Option A with `manifest.json` (stable `schemaVersion: 1`).

Third-party Unity Aseprite importers can sometimes consume `sprite-sheet.json` directly; treat that as optional tooling, not a required dependency.

## Examples

| Path | Notes |
|------|--------|
| [`examples/sample-export/`](../../examples/sample-export/) | Tiny ZIP-shaped fixture |
| [`examples/phaser3/`](../../examples/phaser3/) | Browser Phaser 3 + `load.aseprite` |
| [`examples/godot4/`](../../examples/godot4/) | Godot 4 project + `animation.tres` |

## Custom engines

Prefer `manifest.json` for a stable small schema (`schemaVersion: 1`). Use `sprite-sheet.json` when you already have an Aseprite/Phaser atlas pipeline.
