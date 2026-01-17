# Phase 0011 Steps — Move Entity Tool

## S001 — Confirm command + data shape
- **Intent:** Ground the implementation in existing JSON/entity conventions.
- **Work:**
  - Confirm the on-disk/in-memory entity JSON shape (keys used for x/y and other fields).
  - Confirm renderer hit-testing already returns `{ kind: 'entity', index }` and how authored vs render-space coordinates are handled.
  - Decide the exact command payload shape for moving (target + next position).
- **Done when:** A single command shape is chosen and recorded in the step notes and reflected in subsequent steps.

## S002 — Extend shared IPC command union
- **Intent:** Make “move entity” an official, typed edit command.
- **Work:**
  - Extend `MapEditAtomicCommand` with a `map-edit/move-entity` variant including:
    - `target: { kind: 'entity', index: number }`
    - `to: { x: number; y: number }` (or equivalent explicit x/y fields)
  - Ensure `MapEditCommand` and related request/response types remain consistent.
- **Done when:** TypeScript compiles with the new union member and all exhaustiveness checks are updated.

## S003 — Implement move in MapCommandEngine
- **Intent:** Apply move deterministically and atomically against cloned JSON.
- **Work:**
  - Add a `case` in `MapCommandEngine.applyAtomic` for `map-edit/move-entity`.
  - Validate:
    - map JSON is a record (already required),
    - `entities` is an array,
    - target index is in-range,
    - entity entry is a record with finite numeric `x` and `y`,
    - requested `to.x`/`to.y` are finite.
  - Apply by updating only `x` and `y` on the targeted entity record.
  - Selection effect: keep current selection (no implicit selection changes).
- **Done when:** Engine returns `nextJson` with updated coords or a typed error without mutating the input JSON.

## S004 — Unit tests: MapCommandEngine move-entity
- **Intent:** Satisfy L04 for the new command’s branching logic.
- **Work:** Add tests covering at least:
  - Success: moves entity x/y and preserves other fields.
  - Failure: entities missing/not array.
  - Failure: index out of bounds.
  - Failure: entity entry not an object or missing/invalid x/y.
  - Failure: `to` contains non-finite numbers.
- **Done when:** Tests pass and fail for the right reasons (typed error codes/messages as expected).

## S005 — Integrate move into MapEditService
- **Intent:** Ensure move participates in dirty tracking, history, and revisioning.
- **Work:**
  - Confirm `MapEditService.edit(...)` path already treats atomic commands uniformly; ensure the new command flows through without special casing.
  - Ensure on success:
    - `dirty` becomes true,
    - `lastValidation` becomes null,
    - `revision` increments,
    - history records a new undo entry.
- **Done when:** Move-entity edits produce the same metadata/history behavior as other edits.

## S006 — Unit tests: MapEditService move behavior
- **Intent:** Lock the orchestration behavior to prevent regressions.
- **Work:** Add tests that verify:
  - A successful move bumps `MapDocument.revision` and marks dirty.
  - Undo after a move restores prior coords; redo reapplies.
  - Stale `baseRevision` rejects the move atomically (no store/history mutation).
- **Done when:** Tests cover success + stale failure paths and pass reliably.

## S007 — Add Move tool to renderer tool registry
- **Intent:** Expose the new tool in the existing toolbox UX.
- **Work:**
  - Add `move` to `MapEditorToolId` and tool definitions.
  - Add a corresponding interaction mode (e.g., `MapEditorInteractionMode = 'select' | 'pan' | 'zoom' | 'move'`).
  - Keep Move tool toolbar commands empty unless required.
- **Done when:** The tool appears in the toolbox and switching to it drives the canvas interaction mode.

## S008 — Implement Move interaction in MapEditorCanvas
- **Intent:** Let users drag the selected entity and commit a single main-process edit.
- **Work:**
  - Read current selection from the renderer store.
  - On mouse down in Move mode:
    - if selection is an entity and the pointer is within the entity hit radius, begin a drag.
  - During drag:
    - maintain a renderer-local preview position for the selected entity.
  - On mouse up:
    - send one `window.nomos.map.edit({ baseRevision, command: move-entity(...) })`.
    - on success, clear preview (authoritative snapshot will update via state change).
    - on stale error, refresh snapshot and clear preview.
- **Done when:** Moving is functional end-to-end without generating multiple history entries per drag.

## S009 — Documentation updates (L09)
- **Intent:** Keep subsystem docs accurate for future extension.
- **Work:**
  - Update `docs/map-edit-command-system.md` to list the new atomic command and its shape.
  - Update `docs/renderer-ui-system.md` to describe the Move tool workflow and its commit-on-mouse-up behavior.
  - Update `docs/maps-system.md` if it enumerates supported edit commands.
- **Done when:** Docs match the implemented command and UI behavior.

## S010 — Verification
- **Intent:** Ensure the Phase completes to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual smoke:
    - open a map, select an entity, move it, undo/redo, save, reopen.
- **Done when:** Automated checks pass and smoke steps succeed.

## S011 — Unit tests: MapCommandEngine move-entity (missing coverage)
- **Intent:** Satisfy L04 and Phase acceptance criteria for the new command in `MapCommandEngine`.
- **Work:**
  - Add `MapCommandEngine` unit tests in `src/main/application/maps/MapCommandEngine.test.ts` covering at least:
    - Success: moves entity x/y and preserves other fields.
    - Failure: `entities` missing/not array.
    - Failure: index out of bounds.
    - Failure: entity entry not an object or missing/invalid x/y.
    - Failure: `to` contains non-finite numbers.
- **Done when:** The tests exist, fail for the right typed error codes, and pass.

## S012a — Fix viewport zoom reset when switching tools
- **Intent:** Ensure tool switching (including switching to Move) does not reset the user’s zoom level, so manual smoke testing is reliable.
- **Work:**
  - Update the Map Editor viewport initialization logic so the initial “frame map to view” zoom is applied only when a map is opened (or first becomes decodable), not on later resizes.
  - Confirm switching tools does not reset zoom.
- **Done when:** Switching between Select/Move/Zoom/Pan does not reset the current zoom level.

## S012b — Keep Map Editor toolbar visible for tools with no commands
- **Intent:** Avoid UI layout shifts when selecting a tool (like Move) that has zero toolbar commands.
- **Work:**
  - Ensure the toolbar row remains present with a stable height even when `toolbarCommands` is empty.
  - Confirm switching to Move does not collapse the toolbar or shift the canvas.
- **Done when:** Switching tools does not visually collapse the toolbar area.

## S012 — Manual smoke verification (UI + save/reopen)
- **Intent:** Explicitly verify the editor UX and persistence behavior end-to-end.
- **Work:**
  - Manual smoke:
    - open a map, select an entity, switch to Move, drag, release (commit on mouse-up)
    - undo/redo
    - save, reopen, confirm position persisted
  - Record the results in this Phase’s `review.md` (or in `progress.yaml` step notes).
- **Done when:** The smoke results are recorded and match the acceptance criteria.

## S013 — Revert unrelated agent configuration changes
- **Intent:** Keep the Phase scoped, or explicitly record any approved exceptions.
- **Work:**
  - If `.github/agents/*` changes exist:
    - either revert them, OR
    - explicitly record user approval in the Phase review notes and keep them.
- **Done when:** Any `.github/agents/*` diffs are either reverted or explicitly approved/recorded.

## S014 — Update Phase review record
- **Intent:** Keep the Phase review record accurate after follow-ups.
- **Work:**
  - Update `.ushabti/phases/0011-move-entity-tool/review.md` to reflect which follow-ups are complete and what remains.
- **Done when:** `review.md` matches current status.

## S015 — Unit tests: MapCommandEngine move-entity index validation
- **Intent:** Satisfy L04 by covering remaining decision outcomes in the move-entity path.
- **Work:**
  - Add `MapCommandEngine` tests for `map-edit/move-entity` where `target.index` is negative and non-integer.
- **Done when:** Tests pass and return `map-edit/not-found` for invalid indices.

```
