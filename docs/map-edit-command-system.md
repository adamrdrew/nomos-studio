# Map Edit Command System

## Overview
Nomos Studio’s map editing is implemented as a **transactional command system** owned by the **Electron main process**.
The renderer requests edits over typed IPC (`window.nomos.map.*`) and never mutates map JSON directly.

Key goals:
- **Single source of truth:** main process owns `AppStore.mapDocument`.
- **Round-trip safety:** `MapDocument.json` remains `unknown` within the maps subsystem and is treated as opaque JSON.
- **Atomic edits:** a command (including a transaction) either applies fully or not at all.
- **Determinism:** same command + same starting JSON => same output JSON (no randomness, no time dependency).
- **Explicit selection reconciliation:** main returns selection effects; renderer does not inspect JSON to “guess” validity.
- **Undo/redo:** bounded main-owned history restores `json`, `dirty`, and `lastValidation` exactly.

## Where it lives

### Shared contract (IPC-facing)
- Types and channels: `src/shared/ipc/nomosIpc.ts`

### Main process implementation
- Command application engine: `src/main/application/maps/MapCommandEngine.ts`
- Orchestration + store mutation + history recording: `src/main/application/maps/MapEditService.ts`
- Bounded undo/redo stacks: `src/main/application/maps/MapEditHistory.ts`

### Renderer consumption
- Renderer invokes edits/undo/redo via preload: `window.nomos.map.edit/undo/redo(...)`.
- Selection effects are applied in the renderer store (`useNomosStore`) and/or the map editor UI.

## Command model

### Target references
Edits refer to targets by stable references rather than passing entire objects.

- `MapEditTargetRef`
  - `{ kind: 'light' | 'particle' | 'entity'; index: number }`
  - `{ kind: 'door'; id: string }`

### Atomic commands
Atomic commands are the building blocks for edits.

- `map-edit/delete`
- `map-edit/clone`

Each atomic command includes a `target: MapEditTargetRef`.

### Transaction command
A transaction bundles multiple atomic commands into a single atomic operation.

- `map-edit/transaction`
  - `commands: readonly MapEditAtomicCommand[]`
  - `label?: string` (for history/menu labeling only; must not affect behavior)
  - `selection?: { kind: 'map-edit/selection'; ref: MapEditTargetRef | null }`

Transaction constraints:
- Empty transactions are rejected (`map-edit/transaction-empty`).
- Very large transactions are rejected (`map-edit/transaction-too-large`).
- A transaction step failure returns `map-edit/transaction-step-failed` with `stepIndex` and `cause`.

## Execution model

### `MapCommandEngine` responsibilities
`MapCommandEngine.apply(document, command)` is responsible for:
- Validating the current JSON is an object and cloneable.
- Applying an atomic command or a transaction against a **working cloned JSON** value.
- Returning either:
  - `ok: true` with `{ nextJson, selection, label? }`, or
  - `ok: false` with a typed `MapEditError`.

Importantly: the engine does **not** mutate `AppStore`.

### Atomicity guarantee
Atomicity is enforced by construction:
- The engine computes `nextJson` in memory.
- `MapEditService` commits via a single `store.setMapDocument(nextDocument)` only after success.
- If any step fails (including a transaction step), the store is unchanged.

### Determinism
Determinism is preserved by:
- no time or random dependencies during apply
- no renderer-side mutation
- no partial store writes

## Selection reconciliation

### Input selection (for transactions)
Transactions may carry an explicit selection input:
- omitted => “no selection context”
- `ref: null` => explicitly “nothing selected”
- `ref: MapEditTargetRef` => explicit selected target identity

This is used by main to compute selection effects during transactional edits.

### Selection effects
Main returns a `MapEditSelectionEffect` that the renderer applies verbatim:
- `map-edit/selection/keep`
- `map-edit/selection/clear` with `reason: 'deleted' | 'invalidated'`
- `map-edit/selection/set` with `ref`
- `map-edit/selection/remap` with `{ from, to }`

Where effects are emitted:
- Transaction edit success: `MapEditResult.kind: 'map-edit/applied'` includes `selection`.
- Undo/redo success: `MapEditResult.kind: 'map-edit/applied'` includes `selection`.
- Main-triggered operations (e.g., menu undo/redo) may also include `selectionEffect` in the `nomos:state:changed` payload.

Renderer rule:
- Do not inspect `MapDocument.json` to determine selection validity.
- Apply the effect returned by main.

## Undo/redo history model

### Ownership and bounds
Undo/redo is owned by main and bounded (resource safety).
History is cleared when a new map is opened.

### What is restored
Undo/redo restores the prior document state exactly:
- `json`
- `dirty`
- `lastValidation`

### How edits interact with metadata
On any successful edit (atomic or transaction):
- `dirty` is set to `true`.
- `lastValidation` is cleared to `null`.

Undo/redo restores metadata exactly from the recorded history entry.

### Enablement info
Main exposes `MapEditHistoryInfo` in the state snapshot so UI can enable/disable menu items and shortcuts without additional IPC:
- `canUndo`, `canRedo`, `undoDepth`, `redoDepth`

## IPC surface

Renderer-to-main operations:
- `window.nomos.map.edit({ baseRevision, command })`
- `window.nomos.map.undo({ baseRevision, steps? })`
- `window.nomos.map.redo({ baseRevision, steps? })`

All shapes are defined in `src/shared/ipc/nomosIpc.ts`.

### Revision gating (stale-edit protection)
Edit-like operations are revision-gated to prevent applying commands against a stale renderer snapshot.

- Every renderer-initiated edit/undo/redo request must include `baseRevision` taken from the latest `MapDocument.revision` in the renderer snapshot.
- Main compares `baseRevision` to the current authoritative document revision and rejects mismatches **before** any engine/history/store mutation.
- Rejection uses a typed error:
  - `{ kind: 'map-edit-error', code: 'map-edit/stale-revision', message: string, currentRevision: number }`

Renderer handling rule:
- On `map-edit/stale-revision`, refresh state from main and let the user retry; do not auto-retry the original operation.

## How to extend safely

### Adding a new atomic edit
1. Extend the shared command union in `src/shared/ipc/nomosIpc.ts` with a new `MapEditAtomicCommand` variant.
2. Update `MapCommandEngine.applyAtomic` to implement it against `Record<string, unknown>` JSON.
3. Define selection reconciliation behavior for the new command (what effect should be emitted?).
4. Update `MapEditService.edit` normalization/history recording if needed.
5. Add unit tests that cover all conditional paths in any public methods affected (L04).
6. Update this doc and `docs/maps-system.md` if the external behavior/API changes (L09).

### Extending transactions
- Transactions should remain a wrapper over known atomic commands unless there is a strong reason to open up arbitrary JSON mutation.
- Keep limits explicit (max commands) to preserve resource safety.

## Testing
Core unit tests live under:
- `src/main/application/maps/MapCommandEngine.test.ts`
- `src/main/application/maps/MapEditHistory.test.ts`
- `src/main/application/maps/MapEditService.test.ts`

The Phase 0009 coverage goal is that public methods and their conditional paths are covered (L04).
