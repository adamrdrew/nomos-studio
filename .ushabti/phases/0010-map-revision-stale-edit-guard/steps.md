# Steps — Phase 0010 (Map Document Revisioning + Stale-Edit Protection)

## S001 — Decide and record revision semantics
- Intent: Lock down consistent behavior before threading types/IPC.
- Work:
  - Adopt: initial revision `1` on open.
  - Adopt: increment on every successful edit/undo/redo.
  - Adopt: save does not increment.
  - Adopt: `baseRevision` required for edit-like renderer IPC.
- Done when:
  - Semantics are recorded in `phase.md` under “Chosen semantics”.

## S002 — Add `MapDocumentRevision` + `MapDocument.revision`
- Intent: Introduce the authoritative revision counter into the shared data model.
- Work:
  - Update `src/shared/domain/models.ts`:
    - add `export type MapDocumentRevision = number`.
    - add `revision: MapDocumentRevision` to `MapDocument`.
  - Update any construction sites to supply revision (open map, tests, fixtures).
- Done when:
  - TypeScript compiles with the new required field across main/renderer tests.

## S003 — Add typed stale-revision error
- Intent: Provide a stable, branchable error for stale edit attempts.
- Work:
  - Update `src/shared/domain/results.ts`:
    - extend `MapEditError` with a `code: 'map-edit/stale-revision'` variant that includes `currentRevision`.
- Done when:
  - Main and renderer can branch on `error.code === 'map-edit/stale-revision'` and access `currentRevision` safely.

## S004 — Update IPC contract request shapes to require `baseRevision`
- Intent: Ensure all renderer-initiated edit-like operations prove they’re based on the current snapshot.
- Work:
  - Update `src/shared/ipc/nomosIpc.ts`:
    - `MapEditRequest` includes `baseRevision`.
    - `MapUndoRequest` includes `baseRevision`.
    - `MapRedoRequest` includes `baseRevision`.
  - Update `src/main/ipc/registerNomosIpcHandlers.ts` typing and casting accordingly.
  - Update `src/preload/preload.ts` and `src/preload/nomos.d.ts` signatures to match.
- Done when:
  - All IPC compile-time contracts agree and the preload API surface requires `baseRevision` for edit/undo/redo.

## S004A — Update renderer call sites to pass `baseRevision`
- Intent: Keep compilation and runtime behavior correct after IPC contract requires `baseRevision`.
- Work:
  - Update renderer call sites that invoke `window.nomos.map.edit/undo/redo` to pass `baseRevision` from the latest snapshot’s `mapDocument.revision`.
- Done when:
  - Renderer compiles with the new required `baseRevision` fields and edit/undo/redo IPC requests include `baseRevision`.

## S005 — Set initial revision on open map
- Intent: Establish a consistent baseRevision starting point.
- Work:
  - Update `src/main/application/maps/OpenMapService.ts` to set `revision: 1` on the created `MapDocument`.
- Done when:
  - Open map returns/stores documents with revision 1 and unit tests cover it.

## S006 — Implement stale checks + revision bump in `MapEditService`
- Intent: Enforce atomic stale rejection and monotonic revision increments on every successful mutation.
- Work:
  - Update `src/main/application/maps/MapEditService.ts` public APIs to accept `baseRevision` (either as request objects or explicit params).
  - Add a single private helper that:
    - reads current doc
    - checks baseRevision
    - returns stale error including `currentRevision` on mismatch
    - commits via one store write on success with `revision = current.revision + 1`
  - Ensure stale check occurs before:
    - `history.recordEdit`
    - `history.undo/redo` (critical)
    - `store.setMapDocument`
- Done when:
  - Edit/undo/redo success paths bump revision exactly once per call.
  - Stale mismatch returns typed error and performs no store/history mutation.

## S007 — Wire main handlers to pass baseRevision through
- Intent: Ensure IPC calls reach the revision-checked service paths.
- Work:
  - Update `src/main/main.ts` handler implementations for `editMap/undoMap/redoMap` to pass request objects including `baseRevision`.
  - Update `src/main/ipc/registerNomosIpcHandlers.ts` to avoid defaulting a missing undo/redo request into an unsafe path.
- Done when:
  - IPC handlers compile and use the revision-checked service methods.

## S008 — Update renderer call sites to include `baseRevision`
- Intent: Keep renderer behavior minimal while complying with new IPC contract.
- Work:
  - Update `src/renderer/ui/editor/panels/MapEditorDockPanel.tsx`:
    - handle stale-revision errors by refreshing and surfacing a calm message.
  - Update `src/renderer/ui/editor/EditorShell.tsx`:
    - on stale-revision error: refresh snapshot and display a calm message (“Document changed; refreshed. Please retry.”).
- Done when:
  - Stale-revision error handling is present without auto-retry.

## S009 — Add/adjust unit tests
- Intent: Prove correctness (revision bumps) and safety (no partial mutation) per L04.
- Work:
  - `src/main/application/maps/MapEditService.test.ts`:
    - matching baseRevision success increments revision
    - mismatched baseRevision returns stale error with currentRevision
    - stale edit causes no store mutation, no engine apply, no history mutation
    - stale undo/redo causes no store mutation and does not call history.undo/redo
    - scenario: edit A then stale edit B includes currentRevision
  - `src/main/application/maps/OpenMapService.test.ts`:
    - successful open sets revision to 1
- Done when:
  - Tests pass and explicitly cover atomic stale rejection (no store/history changes).

## S010 — Update subsystem docs (L09)
- Intent: Keep IPC/maps documentation accurate after API behavior changes.
- Work:
  - Update `docs/ipc-system.md` to document `baseRevision` requirement and the stale-revision error.
  - Update `docs/maps-system.md` to include `MapDocument.revision` and revision bump semantics.
  - Update `docs/map-edit-command-system.md` to mention revision gating on edit-like operations.
- Done when:
  - Docs describe revision + stale protection accurately and match implemented shapes.

## S011 — Verify semantics are applied end-to-end
- Intent: Ensure implementation matches the chosen semantics.
- Work:
  - Confirm the code reflects:
    - initial revision `1` on open
    - revision increments on successful edit/undo/redo
    - save does not increment revision
    - baseRevision required for renderer edit/undo/redo IPC
  - Confirm docs in `docs/` describe the same.
- Done when:
  - The above is true in code and docs, and unit tests pass.
