# Godot 4 example

Uses `animation.tres` + `frames/*.png` in the same layout as a Sprite Animator ZIP unpack.

## Run

1. Open [Godot 4.2+](https://godotengine.org/download).
2. **Import** → select this folder (`examples/godot4/`).
3. Press **F5** / Play. You should see a looping bounce square.

`project.godot` already points `run/main_scene` at `main.tscn`.

## Swap in your export

1. Download **ZIP** from Sprite Animator.
2. Replace `frames/`, `animation.tres`, and optionally `manifest.json` in this folder.
3. If you nest assets under a subfolder, edit every `res://frames/...` path inside `animation.tres` (or keep `frames/` next to the `.tres` as shipped).

See also [ENGINE_EXPORT.md](../../docs/animation/ENGINE_EXPORT.md).
