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
separate from the generated `manifest.json` and `qa-report.json`. Use format
`line-sticker-content-review`, version `1`, with `references` and `stickers` arrays.
Record configured character references in order (`referenceImage`, then optional
`referenceImage2`), each with `path` and a measured SHA-256. Paths are relative to
the output directory; a configured absolute reference path may remain absolute.
Record one entry per final sticker with:

- `globalIndex`, `finalPath`, and `sha256` of the reviewed final PNG.
- Expected `phrase` and `actionDesc`, preserving their mapping to the final file.
- A `checks` object containing independent `text`, `character`, `action`, and
  `cropping` objects, each with `status: pass|fail|unverified` and a concise
  `observation` or missing-evidence reason. Missing references, unavailable images,
  and unperformed checks cannot pass.
- Each defect's `check`, `description`, and `state: pending-acceptance`.

The following shows one entry, not a complete multi-sticker review. Repeat it for
the actual configured output count and replace both illustrative hashes with the
measured hashes of the inspected files:

```json
{
  "format": "line-sticker-content-review",
  "version": 1,
  "references": [{
    "path": "reference-image.png",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  }],
  "stickers": [{
    "globalIndex": 1,
    "finalPath": "stickers/sticker-01.png",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "phrase": "早安",
    "actionDesc": "Wave one hand in greeting",
    "checks": {
      "text": {"status": "pass", "observation": "Exact caption is readable at sticker size."},
      "character": {"status": "pass", "observation": "Identity and markings match the reference."},
      "action": {"status": "pass", "observation": "One raised hand visibly waves."},
      "cropping": {"status": "pass", "observation": "Requested composition and caption are complete."}
    },
    "defects": []
  }]
}
```

This record documents visual inspection; it is not emitted or enforced by the
packaging scripts. Do not add approval fields to the generated manifest or
rewrite automated QA results to represent this review.

## Validate the record

From the repository root, run the read-only consistency checker:

```bash
npx tsx scripts/line-sticker/validate-content-review.mts --out output/my-set
# An explicitly selected alternate review path is repository-relative:
npx tsx scripts/line-sticker/validate-content-review.mts \
  --out output/my-set --review output/my-set/content-review-revised.json
# Direct maker jobs may keep their original config outside the output directory:
npx tsx scripts/line-sticker/validate-content-review.mts \
  --out output/my-set --config jobs/my-set/job.config.json
```

The checker derives count from manifest configuration (40/48 for a set, or
`cols * rows` for single-sheet jobs), compares `uploadFile` delivery mappings,
and checks complete unique indices, final PNG decoding/hashes, caption/action
mapping, configured reference hashes and check/defect consistency. Configured
captions and actions must agree with sticker metadata when both sources exist;
contradictory metadata cannot override the configured content. Final PNG paths
must stay within the output directory; source-sheet paths are not delivery paths.
Without `--config`, configured relative reference paths resolve from the output
directory. For a direct maker job, select the original config with `--config` to
resolve those paths from its directory instead. Its raw reference fields must
match the manifest. Review evidence paths still resolve from the output directory
or may be absolute. This option only locates reference images; it does not replace
manifest settings or modify the job. A legacy manifest with unavailable
action/reference sources remains unverified; do not invent them to obtain a
successful result.

Exit `2` indicates CLI usage errors. Exit `1` indicates an inconsistent, incomplete
or unresolved record. Exit `0` means the record is consistent and its checks are
resolved, potentially with explicitly recorded accepted exceptions. The JSON
report keeps `allChecksPass`, failed checks, pending defects, accepted exceptions,
unverified checks and unverified sources separate. An accepted failed check stays
failed and keeps `allChecksPass: false`. This checker cannot verify visual claims
or authenticate the recorded user's acceptance; success does not authorize upload
or certify image content.

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
exception, recording the response in `acceptanceEvidence`. Its check remains
`fail` with an accepted exception; acceptance is not a corrected image or a
passing check. Every failed check needs at least one defect; a passing or
unverified check must not carry a defect marked accepted or pending.

Report structural/packaging results, content-check coverage/results, and accepted
exceptions separately, linking the final images and review record. A completed
manifest, passing `qaReport`, or valid ZIP does not establish content approval or
upload readiness. Upload and review submission still need their own authorization.
