# Credential rotation checklist

Use this when releasing a browser build, rotating keys, or investigating a suspected leak.

## Scope

Production and GitHub Pages builds are **BYOK**: Gemini / Hugging Face credentials must never be baked into `dist/`. Local `vite dev` may use a non-public development fallback; that must not ship.

## Before every public release

1. Confirm no `VITE_*` Gemini/HF secrets are set in the deploy environment.
2. Run `npm run security:secrets`.
3. Run `npm run build` with a synthetic sentinel key (CI already does this) then `npm run security:bundle`.
4. Confirm `npm run dist:budget` passes.
5. Spot-check the deployed site still prompts for a user-supplied API key.

## If a key may have been in an older public build

1. **Rotate** the Google AI Studio / Gemini API key in Google Cloud / AI Studio.
2. Revoke any Hugging Face token that may have been exposed.
3. Update local secrets files (never commit them): `.secrets/`, upload skill credential paths.
4. Re-run `npm run security:secrets` and `npm run security:bundle` on a fresh build.
5. Record the rotation date and which environments were updated.

## Ongoing guards

| Guard | Command / location |
|---|---|
| Repo secret scan | `npm run security:secrets` |
| Production bundle scan | `npm run security:bundle` |
| Dependency audit | `npm run security:audit` |
| CI sentinel | `.github/workflows/ci.yml` build step |

## Status note (2026-09-09)

Application code and CI already enforce BYOK + scans. **Ops owners must still confirm** whether any historical public deploy used a live Gemini key and, if so, that the key was rotated. This checklist does not replace that verification.
