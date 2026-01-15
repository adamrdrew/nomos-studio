# Review — Phase 0010 (Map Document Revisioning + Stale-Edit Protection)

## Summary

Phase intent is implemented in code (revisioning, baseRevision gating, typed stale error, atomic stale rejection, renderer refresh UX, unit tests) and docs are updated to match the implementation. Verification has been performed via `npm test`, `npm run typecheck`, and `npm run lint`.

## Verified

- **Chosen semantics recorded** in `.ushabti/phases/0010-map-revision-stale-edit-guard/phase.md` (initial revision 1 on open; bump on successful edit/undo/redo; save does not bump; baseRevision required for renderer IPC).

- **Shared model revisioning**
	- `MapDocumentRevision` + `MapDocument.revision` added in `src/shared/domain/models.ts`.
	- `OpenMapService` initializes `revision: 1` and test asserts returned/stored revision.

- **Typed stale error**
	- `MapEditError` extended with `map-edit/stale-revision` including `currentRevision` in `src/shared/domain/results.ts`.

- **IPC contract requires baseRevision**
	- `MapEditRequest`, `MapUndoRequest`, `MapRedoRequest` require `baseRevision` in `src/shared/ipc/nomosIpc.ts`.
	- Preload API updated so `window.nomos.map.undo/redo` require a request object.
	- Main wiring updated so `editMap` passes the full request object (not just `command`).

- **Atomic stale rejection**
	- `MapEditService.edit/undo/redo` checks `baseRevision` before calling engine/history/store.
	- Unit tests explicitly assert no `engine.apply`, no history mutation, no store mutation on stale edit/undo/redo.

- **Renderer behavior on stale**
	- Renderer passes `baseRevision: mapDocument.revision` on edit/undo/redo.
	- On stale error, renderer refreshes snapshot and shows “Document changed; refreshed. Please retry.”

## Issues

- **Non-blocking toolchain warning:**
	- `npm run lint` reports a warning that `@typescript-eslint/typescript-estree` does not officially support TypeScript 5.9.3 (but lint exits successfully). Consider aligning the TypeScript version or eslint tooling in a separate toolchain-focused change.

## Required follow-ups

- None required for Phase scope.

## Decision

Phase status: **GREEN / COMPLETE**. The work has been weighed and found complete.

Validated:
- Code matches chosen semantics (open revision=1; successful edit/undo/redo bump revision; save does not bump; baseRevision required for renderer IPC).
- Stale requests fail atomically with `map-edit/stale-revision` including `currentRevision`.
- Renderer passes `baseRevision` and refreshes + informs user on stale.
- Tests, typecheck, and lint succeed.

Non-blocking note:
- `@typescript-eslint` warns about TS 5.9.3 support; lint still exits 0.

