# LINE sticker image fixtures

`real-huahua-sheet-4x5.png` is a 256×256 palette-PNG regression fixture derived
from the real generated sheet `SET-20260718-001/sheet-1/_processed-sheet.png`.
It preserves the production grid, transparency, line art, and anti-aliased edges
while keeping the tracked test asset small.

The fixture is intentionally stored outside ignored `output/` so grid regression
tests run in CI instead of being conditionally skipped.
