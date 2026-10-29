# Final sticker content review

Use after generation, conversion, or recovery when delivering sticker images.
Prompt-only, planning, and dry-run requests do not require image review. For the
transparent 4x5 sprite-sheet branch, also follow its existing
[production review](../../line-sticker-sprite-sheet/references/production-review.md),
including its correction limit and repacking rules.

## Review evidence

Inspect every final delivery PNG at sticker size against its expected caption,
action description, and character reference. Cover the configured output count;
do not stop at a sample or assume that every job contains 20 or 40 stickers.

Save a local `<out>/content-review.json` as an agent-authored review artifact,
separate from the generated `manifest.json` and `qa-report.json`. Record the
character-reference path and one entry per final sticker with:

- `globalIndex`, `finalPath`, and `sha256` of the reviewed final PNG.
- Expected `phrase` and `actionDesc`, preserving their mapping to the final file.
- Independent `text`, `character`, `action`, and `cropping` checks, each using
  `pass`, `fail`, or `unverified`, with a concise observation or missing-evidence
  reason. Missing references, unavailable images, and unperformed checks cannot
  pass.
- Each defect's `check`, `description`, and `state: pending-acceptance`.

This record documents visual inspection; it is not emitted or enforced by the
packaging scripts. Do not add approval fields to the generated manifest or
rewrite automated QA results to represent this review.

| Check | Inspect in the final image |
| --- | --- |
| `text` | Exact caption, punctuation, reading order and readability; no unwanted text or numbers. Respect intentionally empty captions without inventing text. |
| `character` | Identity, markings, proportions, expression and plausible anatomy against the supplied reference. |
| `action` | Requested visible key moment, poses and prop contacts; the caption alone does not prove the action. |
| `cropping` | Complete intended composition, including detached text and props; no unintended clipping or neighboring fragments. |

Review the requested character and composition; do not impose cat-specific
anatomy or full-body framing on unrelated references or approved bust designs.
Programmatic caption rendering still needs inspection of the final composition.

## Repair and acceptance

Prefer reslicing or local layout/text repair for recoverable defects. Image
regeneration remains within the existing authorized workflow and retry budget;
content review does not authorize extra paid calls. Preserve source and corrected
versions. Recheck every affected sticker after reslicing, regeneration, caption
changes, or finalization. Reuse prior observations only while the reviewed image
hash, expected content, and reference remain unchanged.

Unresolved defects stay `pending-acceptance`; unverified checks stay unverified.
Deliver affected images as review candidates and disclose their specific defects.
Mark a defect `accepted` only after the user explicitly accepts that disclosed
exception, recording the response as evidence. Its check remains `fail` with an
accepted exception; acceptance is not a corrected image or a passing check.

Report structural/packaging results, content-check coverage/results, and accepted
exceptions separately, linking the final images and review record. A completed
manifest, passing `qaReport`, or valid ZIP does not establish content approval or
upload readiness. Upload and review submission still need their own authorization.
