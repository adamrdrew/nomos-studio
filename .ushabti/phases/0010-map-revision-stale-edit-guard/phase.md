# Phase 0010 — Map Document Revisioning + Stale-Edit Protection

## Intent
Prevent renderer-initiated map edit operations (edit/transaction/undo/redo) from applying against a stale renderer snapshot by introducing a monotonic `MapDocument.revision` and requiring `baseRevision` on edit-like IPC requests.

This Phase is a single, bounded work order: thread revision through shared models + IPC + main handlers + renderer calls, add atomic stale checks, and add unit tests proving no partial mutations occur on stale requests.

## Chosen semantics
- **Initial revision value:** `1` when a map is successfully opened (`OpenMapService.openMap` success).
- **Increment rule:** `revision += 1` for every *successful* state-changing map operation:
  - `map.edit` (includes atomic commands and `map-edit/transaction`)
  - `map.undo` (even if undo restores a prior JSON)
  - `map.redo`
- **Save behavior:** `saveCurrentDocument()` **does not increment** `revision`.
  - Justification: save does not change `MapDocument.json` or history; revision’s purpose is stale-edit protection for edits against the JSON/history snapshot. Not incrementing avoids spurious stale-revision errors around save while still allowing the renderer to refresh on `nomos:state:changed`.
- **`baseRevision` requirement:** **required** for edit-like renderer→main IPC operations.
  - Justification: optional `baseRevision` would allow “unsafe” callers to bypass stale protection; this Phase is intended as a blocker-level safety invariant.

## Scope

### In scope
- Add `MapDocument.revision` and a `MapDocumentRevision` alias in shared domain.
- Add a new typed map edit error: stale revision (includes `currentRevision`).
- Update IPC request types to include required `baseRevision`:
  - `MapEditRequest`
  - `MapUndoRequest`
  - `MapRedoRequest`
- Main-process stale check performed atomically at the top of edit/undo/redo paths, before any history mutation.
- Revision initialization on open map and revision bump on every successful edit/undo/redo.
- Minimal renderer updates to pass `baseRevision` from the latest snapshot and handle stale-revision errors by refreshing.
- Unit tests proving:
  - revision increments on success
  - stale requests are rejected with `currentRevision`
  - stale requests do not mutate store/history/selection effects
- Documentation updates required by L09 for maps + IPC surfaces.

### Out of scope
- Redesigning the command system, history model, or transaction semantics.
- Introducing automatic retry logic (beyond “refresh and let user retry”).
- Changing selection reconciliation semantics beyond ensuring stale requests return an error and no effect.
- Adding new UI/UX features unrelated to stale protection.

## Constraints (laws + style)
- **L03 (Electron security):** renderer remains unprivileged; all edits occur via preload/IPC.
- **L04 (Testing policy):** new/changed public methods and new conditional paths must be unit-tested.
- **L08 (Testability):** stale checks must be unit-testable without Electron.
- **L09 (Docs):** update `docs/maps-system.md`, `docs/ipc-system.md`, and `docs/map-edit-command-system.md` to reflect revision + baseRevision requirements.
- **Style (TypeScript):** prefer discriminated unions; avoid `any`; keep changes minimal and explicit.

## Type changes (pseudo-types)

### Shared domain — `src/shared/domain/models.ts`
```ts
export type MapDocumentRevision = number;

export type MapDocument = Readonly<{
  filePath: string;
  json: unknown;
  dirty: boolean;
  lastValidation: MapValidationRecord | null;
  revision: MapDocumentRevision;
}>;
```

### Shared domain errors — `src/shared/domain/results.ts`
Add a new map edit error variant (discriminated union) that includes the current revision:
```ts
export type MapEditStaleRevisionError = Readonly<{
  kind: 'map-edit-error';
  code: 'map-edit/stale-revision';
  message: string;
  currentRevision: MapDocumentRevision;
}>;

export type MapEditError =
  | MapEditStaleRevisionError
  | Readonly<{
      kind: 'map-edit-error';
      code:
        | 'map-edit/no-document'
        | 'map-edit/invalid-json'
        | 'map-edit/not-found'
        | 'map-edit/unsupported-target'
        | 'map-edit/transaction-empty'
        | 'map-edit/transaction-too-large'
        | 'map-edit/transaction-step-failed';
      message: string;
      stepIndex?: number;
      cause?: MapEditError;
    }>;
```

## IPC changes (src/shared/ipc/nomosIpc.ts)

### Requests
Thread `baseRevision` (required) through edit-like operations:
```ts
export type MapEditRequest = Readonly<{
  baseRevision: MapDocumentRevision;
  command: MapEditCommand;
}>;

export type MapUndoRequest = Readonly<{
  baseRevision: MapDocumentRevision;
  steps?: number;
}>;

export type MapRedoRequest = Readonly<{
  baseRevision: MapDocumentRevision;
  steps?: number;
}>;
```

### Responses
No envelope changes needed because responses already use:
```ts
export type MapEditResponse = Result<MapEditResult, MapEditError>;
export type MapUndoResponse = Result<MapEditResult, MapEditError>;
export type MapRedoResponse = Result<MapEditResult, MapEditError>;
```
The new stale-revision error flows via `MapEditError`:
```ts
{
  kind: 'map-edit-error',
  code: 'map-edit/stale-revision',
  message: string,
  currentRevision: number
}
```

## Main implementation plan

### Where to read current revision
- Read from `store.getState().mapDocument?.revision`.

### Where to perform stale checks (must be atomic)
- In `src/main/application/maps/MapEditService.ts`, at the top of:
  - `edit(...)`
  - `undo(...)`
  - `redo(...)`
- Specifically:
  1) Load `currentDocument` (no-document check).
  2) Compare `request.baseRevision` to `currentDocument.revision`.
  3) If mismatch, return stale error **before** calling:
     - `toDocumentState(...)` (clone)
     - `engine.apply(...)`
     - `history.recordEdit(...)`
     - `history.undo()/redo()`
     - `store.setMapDocument(...)`

### How to set initial revision on open map
- In `src/main/application/maps/OpenMapService.ts`, set `revision: 1` when constructing the new `MapDocument`.
- Ensure `history.onMapOpened(document)` is called with the revisioned document (history ignores revision today).

### How/where to increment revision on successful mutations
- Add a single internal helper in `MapEditService` used by all mutation paths:
  - Example shape (pseudo):
    ```ts
    private commitMapDocument(next: MapDocument, selection?: MapEditSelectionEffect, historyEntry?: MapHistoryEntry): void
    ```
  - The helper is responsible for setting:
    - `next.revision = current.revision + 1` (monotonic)
    - `store.setMapDocument(nextWithBumpedRevision)`
    - any history mutation (for edit) happens only after stale check passes

- Edit path:
  - On success, bump revision exactly once per `edit(...)` call, then commit store.

- Undo/redo paths:
  - Perform stale check *before* calling `history.undo()` / `history.redo()`.
  - After `restore` is computed and store update is about to occur, bump revision exactly once per `undo(...)`/`redo(...)` call.

### IPC handler wiring
Update the main handler wiring so IPC passes `baseRevision` through:
- In `src/main/main.ts`:
  - `editMap: async (request) => mapEditService.edit(request)`
  - `undoMap: async (request) => mapEditService.undo(request)`
  - `redoMap: async (request) => mapEditService.redo(request)`

- In `src/main/ipc/registerNomosIpcHandlers.ts`:
  - Remove the `(request ?? {})` defaulting for undo/redo (or keep defaulting but ensure a missing request becomes a typed error rather than bypassing stale protection).

### Atomic stale rejection invariant
For stale requests, verify by construction:
- No calls into `MapCommandEngine.apply`.
- No calls into `MapEditHistoryPort.recordEdit/undo/redo`.
- No calls into `AppStore.setMapDocument`.
- No selection effect emitted.

## Renderer changes (minimal)

### Pass baseRevision from latest snapshot
- In `src/renderer/ui/editor/panels/MapEditorDockPanel.tsx`:
  - When calling `window.nomos.map.edit`, include `baseRevision: mapDocument.revision`.

- In `src/renderer/ui/editor/EditorShell.tsx` keyboard undo/redo handler:
  - When calling `window.nomos.map.undo/redo`, include `baseRevision: mapDocument.revision`.
  - If `mapDocument === null`, do nothing.

### Behavior on stale-revision error
When an IPC response is `ok: false` with:
- `error.kind === 'map-edit-error'`
- `error.code === 'map-edit/stale-revision'`

Do:
1) `await useNomosStore.getState().refreshFromMain()`.
2) Surface a non-scary message (minimal):
   - Prefer a small Blueprint toast if available/acceptable, otherwise a short inline status in the editor shell.
   - Message: “Document changed; refreshed. Please retry.”
3) Do not auto-retry the operation.

## Menu / enablement impact
- Renderer keyboard shortcuts currently invoke `window.nomos.map.undo/redo`; these must be updated to pass `baseRevision`.
- Main menu Undo/Redo handlers currently call `mapEditService.undo()/redo()` directly (no IPC). They cannot be stale relative to renderer state.
  - Ensure these still bump revision on success via the shared commit helper.
  - If the implementation unifies all undo/redo paths under a `baseRevision`-requiring API, main menu handlers should supply `baseRevision` from `store.getState().mapDocument.revision`.

## Tests (must be included)

### A) Map edit: matching baseRevision succeeds + increments revision
- Location: `src/main/application/maps/MapEditService.test.ts`
- Arrange store with document revision `r`.
- Call `service.edit({ baseRevision: r, command: ... })`.
- Assert:
  - `ok === true`
  - stored document revision is `r + 1`

### B) Map edit: mismatched baseRevision fails stale + no mutations
- Same file.
- Arrange store with document revision `r = 2`, call edit with `baseRevision = 1`.
- Assert:
  - `ok === false`
  - `error.code === 'map-edit/stale-revision'`
  - `error.currentRevision === 2`
  - store `setMapDocument` was not called
  - `history.recordEdit` was not called
  - `engine.apply` was not called

### C) Undo/redo: mismatched baseRevision fails stale + no history/store mutation
- Same file.
- Provide a `MapEditHistoryPort` stub that would increment counters (or throw) on `undo/redo`.
- Call `undo({ baseRevision: stale })` / `redo({ baseRevision: stale })`.
- Assert:
  - stale error with `currentRevision`
  - `history.undo/redo` not called
  - `store.setMapDocument` not called

### D) Open map sets revision to 1
- Location: `src/main/application/maps/OpenMapService.test.ts`
- On successful open, assert returned/stored `MapDocument.revision === 1`.

### E) Scenario test: A then stale B includes currentRevision
- Location: `src/main/application/maps/MapEditService.test.ts`
- Apply edit A with `baseRevision = 1` → expect revision becomes 2.
- Attempt edit B with `baseRevision = 1`.
- Assert stale error and `currentRevision === 2`.

## Risks & mitigations
- **Breaking IPC API (baseRevision required):** update all call sites in preload, renderer, and main handlers in the same change; keep compile-time coverage via TypeScript.
- **Forgetting to bump revision on one mutation path:** enforce a single `commit`/`applyMutation` helper in `MapEditService` used by edit/undo/redo.
- **Accidentally mutating history before stale check:** ensure undo/redo stale check happens before calling `history.undo/redo` (tests explicitly assert no calls).
- **User-visible confusion on stale errors:** renderer refreshes immediately and shows a calm message; no retries.
