# Slice review and deterministic layout

Use this workflow for authorized image production. Prompt-only requests stop
after prompt drafting. Repacking is layout work within the requested sheet;
exporting a LINE package, uploading, and submitting remain separate steps.

## Before generation

Review every phrase/action pair against the inspected character reference:

- One visible key moment, not simultaneous before/after actions.
- Two front paws for a cat unless the reference or user explicitly specifies
  otherwise. Assign each paw a plausible role; holding a magnifier, holding rice,
  and putting a paw on the waist cannot all happen together.
- State where each prop sits and what touches it. For ribbon cutting, place the
  ribbon between two stands with the scissor blades contacting it and visible
  separated ends; holding scissors near an intact ribbon is insufficient.
- Default to a complete character, including ears, paws and tail, inside the
  workspace. A bust composition needs an explicit user request or accepted
  design; do not silently substitute one to fit the caption.
- Keep text and props readable at 370 x 320. Avoid extra numbers and incidental
  text; caption delimiters and planning indices must not be drawn.

Resolve impossible or ambiguous actions before spending a generation call.

## Generate, slice, review, repack

1. Save the original PNG, populated prompt, reference provenance and actual
   dimensions. Request roomy transparent gutters, but treat generated geometry
   as measured data rather than a guarantee.
2. For a genuinely transparent source, read `line-sticker-maker` and slice with
   V2 `--already-keyed`; never re-key. Use detected cuts when the original grid
   is uneven, equal cuts when appropriate. Preserve alternate slices separately.
   Check all 20 positions: an automatic cut can retain neighboring fragments or
   remove detached text, props and outlines. Adjust cuts without deleting owned
   foreground. Missing source content cannot be recovered by padding.
3. Record the independent content checks below for every slice. Fix a slicing
   defect by reslicing first. Spend the single corrective image attempt only on
   content defects (wrong text/identity/action, unwanted text, missing anatomy,
   painted backgrounds, or inseparable overlapping artwork). Do not spend it on
   aspect ratio, output resolution or recoverable spacing alone.
4. Build an ordered JSON array of 20 reviewed PNG paths, relative to that JSON
   file. Paths must be distinct and follow input reading order. Repack with:

   ```bash
   npx tsx skills/line-sticker-sprite-sheet/scripts/repack-sprite-sheet.mts \
     --inputs output/my-set/reviewed-paths.json \
     --out output/my-set/final-sheet.png > output/my-set/repack-report.json
   ```

   The output must be a new path in an existing directory. The script trims only
   fully transparent pixels, scales each whole slice proportionally to fit
   680 x 580, and centers it in a 740 x 640 cell with at least 30 transparent
   pixels on every edge. It builds exactly 2960 x 3200 / 4 x 5 and runs the
   structural checker. It rejects empty, opaque, non-PNG and animated inputs.
   It does not certify semantic transparency, content, or review approval.
5. Inspect the final sheet and slices at sticker size. Record final geometry
   separately from original generation size and disclose any upscaling; a larger
   canvas does not add source detail. Return the original, final sheet, ordered
   input list, repack report and content review.

## Independent content checks

Use a local review JSON with one entry per input index, preserving caption and
source path. For each of these checks use `pass`, `fail` or `unverified`:

| Check | Evidence to inspect |
| --- | --- |
| `text` | Exact caption, punctuation, order, readability; no extra text/numbers |
| `character` | Reference identity, markings, proportions, expression and anatomy |
| `action` | Intended key moment, visible prop relationships and visual joke |
| `cropping` | Complete intended composition; no clipped content or neighbor fragments |

Record defects individually with `index`, `check`, `description`, and
`state: pending-acceptance`. Do not collapse these checks into an overall pass
because alpha/geometry passed. A correct caption does not prove the action.

After the one content correction, recheck every affected cell and preserve both
versions. Unresolved defects remain `pending-acceptance`; final images may be
provided as review candidates, but do not label their content approved or ready
for downstream upload. Show the specific cells and defects to the user. Mark a
defect `accepted` only when the user explicitly accepts the disclosed defect,
and record that response as evidence. The corresponding check remains `fail`
with an accepted exception, rather than being rewritten as `pass`.

Distinguish `structuralPass`, individual content checks and accepted exceptions
in the final report. Never hide an unresolved action or clipping issue by
resizing, repacking, or a generic completion status.
