# Phase 0013 Steps — Asset Browser + Property Editor Improvements

## S001 — Inspect current Asset Browser + Properties implementations
- **Intent:** Identify current component boundaries and data sources before changing UI or edit flows.
- **Work:**
  - Locate renderer components used by Inspector:
    - Asset Browser UI and how it renders entries/icons
    - Properties viewer UI (currently raw JSON)
  - Identify how asset index entries are exposed to renderer state (`AppStateSnapshot.assetIndex`).
  - Identify how selection is computed and represented in renderer store.
  - Inventory the property fields for each editable selection kind (entity/light/particle/door) based on the decoded view models.
- **Done when:** The list of files/components to touch and the field inventory per selection kind is recorded.

## S002 — Dark-mode styling for Asset Browser panel
- **Intent:** Make Asset Browser visually consistent with the app’s dark theme.
- **Work:**
  - Replace white/light backgrounds with a mid-gray surface.
  - Ensure text/icons are very light gray/white.
  - Ensure hover/selection states remain readable.
  - Use existing Blueprint primitives/tokens (no new palette).
- **Done when:** Asset Browser renders as dark-mode and matches the Inspector’s dark UI.

## S003 — Color-coded icons by asset type
- **Intent:** Improve scannability and match the requested color mapping.
- **Work:**
  - Implement file type classification by extension (case-insensitive) and directory detection.
  - Apply icon colors using Blueprint `Colors.*` constants:
    - Folder blue, PNG red, MIDI green, Soundfont yellow, JSON purple, WAV orange, Font pink, fallback teal.
  - Confirm colors are bright enough on dark background.
- **Done when:** Asset Browser shows the specified icon colors for representative files and folders.

## S004 — Dark-mode styling for Properties panel container
- **Intent:** Make Properties section visually consistent before changing its content.
- **Work:**
  - Update Properties panel container/card styles to the same dark-mode surface treatment as Asset Browser.
- **Done when:** Properties panel no longer appears as a white block.

## S005 — Define a minimal, typed “update fields” map edit command (shared IPC)
- **Intent:** Provide a safe, narrow way to persist property edits in main.
- **Work:**
  - Extend `MapEditAtomicCommand` with a new variant (example):
    - `map-edit/update-fields`
    - `target: MapEditTargetRef`
    - `set: Record<string, string | number | boolean | null>`
  - Decide and document semantics:
    - only JSON primitives allowed (no objects/arrays)
    - reject non-finite numbers
    - selection effect is keep
- **Done when:** Shared IPC types compile and any exhaustiveness checks are updated.

## S006 — Implement the command in `MapCommandEngine`
- **Intent:** Apply property changes deterministically to cloned JSON.
- **Work:**
  - Add `case` in `applyAtomic` for `map-edit/update-fields`.
  - Validate:
    - root JSON is a record
    - targeted collection exists (entities/lights/particles arrays, doors array/record as applicable)
    - target exists and is a record
    - each `set` value is allowed and finite (for numbers)
  - Apply by setting keys on the target record.
- **Done when:** Engine returns updated JSON or a typed error without mutating input.

## S007 — Unit tests: `MapCommandEngine` update-fields
- **Intent:** Satisfy L04 for the new command’s branching logic.
- **Work:** Add tests covering at least:
  - success for each supported target kind
  - failure: missing collection/not array
  - failure: target not found
  - failure: target entry not an object
  - failure: set contains non-finite number
  - failure: set contains unsupported value type (if representable)
- **Done when:** Tests pass and assert correct typed errors.

## S008 — Integrate update-fields into `MapEditService` + history
- **Intent:** Ensure edits affect document metadata, history, revision, and undo/redo correctly.
- **Work:**
  - Ensure update-fields flows through the existing edit path.
  - Verify on success: dirty=true, lastValidation=null, revision++, history recorded.
- **Done when:** Property edits behave like other edits in main.

## S009 — Unit tests: `MapEditService` property edit behavior
- **Intent:** Lock in orchestration behavior and stale-edit protection.
- **Work:** Add tests verifying:
  - success updates revision/dirty/lastValidation
  - undo/redo restores prior JSON exactly
  - stale baseRevision rejects atomically
- **Done when:** Tests pass and cover success + stale failure.

## S010 — Implement Properties editor UI (renderer)
- **Intent:** Replace raw JSON display with an editable GUI.
- **Work:**
  - Replace `<pre>` JSON rendering with a form-driven editor.
  - Hide `index` always.
  - For each field in the decoded view model:
    - string => text input
    - number => text input with parse+validation and commit rules
    - rgb => three numeric inputs 0–255
    - degrees => numeric input 0–360
    - textures => dropdown populated from assetIndex entries under the textures folder
    - entity defname => dropdown populated from entities manifest (loaded via `readFileBytes`)
  - Commit edits by sending a single `window.nomos.map.edit({ baseRevision, command: update-fields(...) })`.
  - On stale revision: refresh snapshot and show a warning.
- **Done when:** Editing fields updates the live map state via main and no raw JSON is shown.

## S011 — Update docs (L09)
- **Intent:** Keep subsystem docs accurate after introducing property editing.
- **Work:**
  - Update `docs/renderer-ui-system.md` to describe editable Properties and dark-mode Inspector styling.
  - Update `docs/map-edit-command-system.md` to document the new atomic command and its payload/validation rules.
  - Update `docs/maps-system.md` if it enumerates edit commands.
- **Done when:** Docs match the implemented behavior.

## S012 — Verification
- **Intent:** Finish the Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual smoke:
    - Asset Browser and Properties are dark-themed and readable.
    - Asset Browser icon colors match the mapping.
    - Properties editor edits persist via save+reopen.
    - Undo/redo works for property edits.
- **Done when:** Automated checks pass and manual smoke results are recorded.

## S013 — Post-S010 Inspector tweaks (contrast + wall/sector edits + entity defs loader)
- **Intent:** Address follow-up UX and correctness issues discovered during manual smoke.
- **Work:**
  - Make Inspector section titles (“Asset Browser”, “Properties”) use high-contrast text on the dark header.
  - Extend `MapEditTargetRef` and the `map-edit/update-fields` command implementation to support `wall` and `sector` targets.
  - Update renderer selection/reference handling to support the new target kinds without enabling unrelated commands.
  - Make wall and sector properties editable in the Properties editor (textures via dropdown; numbers via validated numeric inputs; keep identity fields read-only).
  - Fix entity defname dropdown loading so it transitions out of “loading” and shows options when the manifest is readable.
  - Update docs that describe edit targets/commands.
  - Add/update unit tests for any new conditional branches (L04).
- **Done when:** The three reported issues are resolved, tests/typecheck/lint pass, and docs match behavior.

## S014 — Close L04 gaps: MapCommandEngine update-fields edge-branch tests
- **Intent:** Satisfy L04 by exercising remaining conditional branches in the public `MapCommandEngine.apply` path for `map-edit/update-fields`.
- **Work:** Add/update unit tests in `src/main/application/maps/MapCommandEngine.test.ts` to cover:
  - update-fields accepts `null` values in `set` (e.g., `back_sector: null`)
  - update-fields rejects empty/whitespace keys in `set`
  - update-fields rejects non-array `sectors` for sector targets (`map-edit/invalid-json`)
  - update-fields rejects non-array `doors` for door targets (`map-edit/invalid-json`)
  - update-fields rejects non-integer indices for indexed targets (e.g., `index: 1.5` => `map-edit/not-found`)
- **Done when:** The new tests pass and explicitly assert the expected error codes / success behavior.
