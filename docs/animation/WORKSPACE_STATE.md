# Workspace settings, generation, and history

## Provider settings

Sprite Animator supports Gemini and OpenRouter. LINE stickers and comics use
`useSettings('gemini')`, including a Gemini-only settings dialog. Their model and
resolution choices do not change the animation tool's selected provider.

Non-secret profiles live in `image_provider_settings_v1_gemini` and
`image_provider_settings_v1_openrouter`; `image_provider` keeps the animation
preference. Legacy model/resolution keys are imported only into the provider
that owns the model. Credentials remain in session storage.

## Generation lifecycle

Each animation request has an AbortController. Reset, replacement images,
generation-input changes, restoration, and navigation invalidate the old request.
Status, result, error, and completion callbacks must also verify that the request
is current, because cancellation alone does not guarantee an upstream operation
stops. Frame delays, retries, and storyboard calls receive the same signal.

Local chroma processing and slicing discard stale work as well. Playback speed
and preview scale changes do not cancel generation. Cancellation cannot reverse
an upstream request that has already been processed or billed.

Project restoration has its own revision and waits for that revision's slices
before restoring frame selection. Saved crop overrides and slicing geometry take
precedence over generation-time auto-alignment, including same-image reloads.

## Saved animation projects

The `sprite-animator-project-history` IndexedDB database stores full snapshots in
`projects` and lightweight summaries in `projectMetadata`. Opening the history
list and enforcing retention read summaries instead of cloning every image.
Schema version 2 backfills summaries from version 1 in an atomic upgrade;
an upgrade failure preserves the original database. Save and retention changes
commit in one transaction. The existing
limit remains ten projects, ordered newest first; evicted snapshots are deleted
in that same transaction. The UI reports success only after commit.

Legacy `sprite_animator_project_list` and `sprite_animator_project_*` entries are
migrated on first use. Valid orphaned snapshots are included in the same newest-ten
retention policy. Existing IndexedDB records take precedence over matching legacy
IDs. Original legacy entries are removed only after migration commits; malformed
or missing entries remain available for recovery and produce a visible warning.

The `processedLegacyIds` store records imported, deleted, and evicted IDs so a
failed legacy cleanup cannot resurrect them. A failed or blocked database operation
preserves the editor and legacy data, displays an error, and offers Retry. Browser
storage availability and quota still depend on the user's browser.

## Regression checks

- `e2e/provider-isolation.spec.ts`: provider profiles, fixed-provider tools, keys.
- `e2e/animation-cancellation.spec.ts`: late remote and local processing results.
- `e2e/animation-restore.spec.ts`: saved crops, selection, and slicing geometry.
- `e2e/project-history.spec.ts`: native transactions, migration, failures, retry.
- `e2e/openrouter-provider.spec.ts`: generation, export, save, reload, restoration.

Run `npm run ci` for the complete local quality gate. Browser calls use fixtures
and mocked providers; they do not generate paid images or upload sticker packages.
Tests bind to `127.0.0.1` explicitly. If another local project uses port 4173, run
`PLAYWRIGHT_TEST_PORT=4187 npm run ci` to use a separate test server.
