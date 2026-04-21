# Auto Slice Consistency Design

Date: 2026-04-21  
Project: Sprite-Animator  
Scope: Improve output quality consistency for AI-generated sprite sheets (slice alignment)

## 1. Problem Statement

Current pain point is inconsistent slicing when using AI-generated sprite sheets in sprite sheet mode.  
The most visible issue is grid misalignment (cell boundaries do not match character placement), causing frame cut-off or unstable preview quality.

Goal is to make slicing fully automatic in normal flow and only surface minimal fallback guidance when confidence is low.

## 2. Objectives and Non-Objectives

### Objectives

- Improve auto-slice success rate for AI-generated sprite sheets.
- Reduce visible defects caused by wrong grid/offset decisions.
- Keep normal UX uninterrupted (no extra manual steps when confidence is high).
- Provide one-time corrective suggestion only when auto confidence is insufficient.

### Non-Objectives

- No multi-step manual wizard redesign in this phase.
- No major changes to frame generation model behavior.
- No broad refactor unrelated to slice alignment quality.

## 3. Recommended Approach

Adopt a multi-stage automatic alignment pipeline with minimal fallback:

1. Generate multiple grid hypotheses.
2. Score each candidate using content consistency signals.
3. Select best candidate with confidence thresholds.
4. Trigger one-time fallback hint only when confidence is below threshold.

This approach maximizes automation while keeping the system robust against ambiguous outputs.

## 4. Architecture and Module Boundaries

Introduce `AutoSlicePipeline` with four single-responsibility stages:

### 4.1 `GridHypothesisStage` (coarse localization)

- Input: sprite sheet image and optional expected frame range.
- Output: candidate set of `(cols, rows, cellW, cellH, offsetX, offsetY)` with initial confidence.
- Responsibility: propose candidates only.

### 4.2 `ContentConsistencyStage` (fine scoring)

- Slice image with each candidate and compute consistency signals.
- Output: scored candidates plus diagnostics.
- Responsibility: evaluate quality only, without candidate generation logic.

### 4.3 `BestFitSelector` (decision)

- Select highest scored candidate and apply hard constraints.
- If confidence passes threshold, use automatically.
- If not, emit uncertain decision state.

### 4.4 `FallbackHintStage` (minimal backup)

- Trigger only when uncertain.
- Output one-time correction hints (recommended `cols/rows`, offset direction and magnitude).
- Avoid intrusive interaction loops.

## 5. Data Flow and Scoring Strategy

Pipeline flow:

`Input sheet` -> `candidate grids` -> `candidate slicing` -> `foreground analysis` -> `consistency scoring` -> `best fit or fallback hint`

Weighted score (`0-100`) for each candidate:

- `S_bbox_stability` (35%): stability of foreground bounding box size and position.
- `S_centroid_drift` (25%): smoothness of foreground centroid movement.
- `S_foreground_occupancy` (20%): valid foreground pixel ratio per cell.
- `S_edge_penalty` (10%): penalty when foreground sticks to cell borders (possible clipping).
- `S_temporal_consistency` (10%): continuity between neighboring frames.

Initial threshold policy:

- `score >= 75`: auto-accept.
- `60 <= score < 75`: auto-accept with low-confidence flag for telemetry.
- `score < 60`: trigger one-time fallback hint.

## 6. Error Handling and Safety

- On stage failure, fall back to existing slicing flow; do not block output.
- Use structured error codes (for example `GRID_NOT_CONFIDENT`, `IMAGE_NO_FOREGROUND`) instead of raw technical errors in UI.
- Add runtime budget guard (target 300-500ms); if exceeded, switch to fast fallback path.

## 7. Minimal Fallback UX

Fallback appears once only when confidence is low:

- Suggested `cols/rows`.
- Suggested `offsetX/offsetY` adjustment direction and magnitude.
- Single action button: "Apply suggestion and preview".

If user ignores the hint, regular flow remains available with no forced wizard.

## 8. Validation and Testing Plan

### 8.1 Unit tests

- Candidate generation coverage and boundary behavior.
- Per-signal scoring correctness with controlled fixtures.
- Threshold decision and fallback trigger logic.

### 8.2 Golden dataset evaluation

- Build a curated set of difficult AI-generated sprite sheets.
- Compare old flow vs new pipeline on:
  - slice success rate,
  - visual defect rate,
  - confidence calibration quality.

### 8.3 Performance checks

- Track end-to-end auto-slice latency.
- Target: P95 under agreed interactive budget (initial target under 500ms, subject to device baseline).

## 9. Rollout Strategy

Phase 1:

- Implement pipeline behind a feature flag.
- Run internal validation on golden dataset.

Phase 2:

- Enable by default for AI-generated sprite sheet mode.
- Collect confidence and fallback telemetry.

Phase 3:

- Tune weights and thresholds based on real-world failures.

## 10. Open Decisions Resolved

- Primary optimization target: slicing consistency for AI-generated sprite sheets.
- Strategy preference: automation-first.
- Approved architecture: multi-stage auto-alignment pipeline.
- Backup policy: minimal one-time suggestion only when confidence is low.

## 11. Success Criteria

- Noticeable reduction in misaligned slice outputs for AI-generated sprite sheets.
- Most users complete flow without manual correction.
- Fallback hint appears only in genuinely ambiguous cases.
- No regression in normal export flow stability.
