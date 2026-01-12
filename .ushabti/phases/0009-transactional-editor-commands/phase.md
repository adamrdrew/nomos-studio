# Phase 0009 — Transactional Editor Commands + Undo/Redo

## Intent
Introduce a safe, deterministic, transactional map editor command system with undo/redo, while preserving existing architectural invariants:
- Main process remains the single source of truth (AppStore).
- Renderer only requests edits via typed IPC (`window.nomos.*`).
- `MapDocument.json` remains `unknown` for round-tripping.
- No duplicated validator logic in renderer; validation remains external.

This Phase records a single bounded work order: move from one-off `MapEditService.edit(Delete/Clone)` to a command engine with atomic batch application and a main-process history stack.

## Scope

### In scope
- A shared, typed editor command model (discriminated unions) for map edits.
- Transactional application: apply a batch atomically (all-or-nothing).
- Main-process undo/redo stacks for the current open map.
- Deterministic behavior: same input command + same JSON => same output JSON.
- Selection reconciliation via explicit result metadata (no renderer heuristics).
- Minimal preload/IPC additions for undo/redo (and optional batch apply).
- Unit tests covering all conditional paths for new public APIs (L04).
- Subsystem docs updates (L09): maps + IPC.

### Out of scope
- Adding new edit tools beyond the existing primitives (Delete/Clone) other than the transaction wrapper.
- UI redesigns or new panels.
- Persisting undo history to disk.
- A full JSON Patch implementation for arbitrary edits.
- Re-validating maps automatically after edits.

## Constraints (laws + system invariants)
- **L03 Electron security**: renderer has no Node; all authoritative edits occur in main; preload surface stays narrow.
- **L04 Testing policy**: every new/changed public method has unit tests covering all branches.
- **L05 Resource safety**: undo/redo must be bounded; no unbounded retained JSON.
- **L08 Testability**: history/engine logic is injectable and deterministic.
- **L09 Documentation**: update `docs/maps-system.md` and `docs/ipc-system.md` to match.
- **Architectural invariants from user request**:
  - Main process is the single source of truth.
  - `MapDocument.json` treated as `unknown` and preserved for round-tripping.
  - No partial apply; transactional atomicity.
  - Undo/redo restores the exact prior JSON.
  - Selection reconciliation must be explicit.

## Proposed design (API shapes + responsibilities)

### A) Command model

#### Location
- **Shared types (IPC-facing)** live in `src/shared/ipc/nomosIpc.ts` because the renderer must send commands over IPC.
- **Main-only implementation** lives under `src/main/application/maps/` (engine/service/history).

#### Command shapes (TypeScript discriminated unions)
Keep the existing `MapEditCommand` primitives and add a transaction wrapper:

```ts
export type MapEditAtomicCommand =
  | Readonly<{ kind: 'map-edit/delete'; target: MapEditTargetRef }>
  | Readonly<{ kind: 'map-edit/clone'; target: MapEditTargetRef }>;

export type MapEditCommand =
  | MapEditAtomicCommand
  | Readonly<{
      kind: 'map-edit/transaction';
      label?: string; // optional: for history/menu labels only
      commands: readonly MapEditAtomicCommand[];
      selection?: MapEditSelectionInput; // optional: explicit input used for reconciliation
    }>;

export type MapEditSelectionInput = Readonly<{
  kind: 'map-edit/selection';
  ref: MapEditTargetRef | null;
}>;
```

Notes:
- Keep transaction composition only over the known atomic commands for now (prevents opening up arbitrary JSON mutations).
- `label` is optional and must not affect determinism.

#### How commands are applied
Split “pure transform” from “store mutation”:
- `MapCommandEngine` (main) applies commands to an *in-memory working copy* and returns:
  - `nextJson` (new JSON object)
  - `effects` (selection reconciliation, optional mapping)
  - `history` data (undo record)
- `MapEditService` (application orchestration) is responsible for:
  - reading current `MapDocument` from `AppStore`
  - calling engine
  - committing the new `MapDocument` via `store.setMapDocument(nextDocument)` once
  - pushing an undo entry / clearing redo

This enforces atomicity by construction: no store writes until the engine returns success.

#### Apply result shape (selection reconciliation)
Extend the existing `MapEditResult` to include a deterministic selection reconciliation payload and history capabilities:

```ts
export type MapEditSelectionEffect =
  | Readonly<{ kind: 'map-edit/selection/keep' }>
  | Readonly<{ kind: 'map-edit/selection/clear'; reason: 'deleted' | 'invalidated' }>
  | Readonly<{ kind: 'map-edit/selection/set'; ref: MapEditTargetRef }>
  | Readonly<{ kind: 'map-edit/selection/remap'; from: MapEditTargetRef; to: MapEditTargetRef }>;

export type MapEditHistoryInfo = Readonly<{
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}>;

export type MapEditResult = Readonly<{
  kind: 'map-edit/applied';
  selection: MapEditSelectionEffect;
  history: MapEditHistoryInfo;
}>;
```

Backward compatibility:
- Keep supporting the existing `MapEditResult` union variants during migration by making `MapEditResponse` accept both shapes temporarily, or introduce a new `kind` and update renderer in the same PR.

### B) Transaction model

#### Representation
Prefer a single `map-edit/transaction` command. No multi-call begin/commit is needed.
- Renderer sends one IPC call; main applies atomically.
- Atomicity is guaranteed because main computes on a working copy and commits once.

#### Atomicity in main
Implementation rule:
- Never mutate `AppStore` during evaluation.
- Use `structuredClone(currentDocument.json)` (or equivalent) to create a working JSON value.
- Apply each atomic command to the working JSON, accumulating effects.
- If any step fails, return a typed error; do not call `store.setMapDocument`.

Preconditions validated before commit:
- Map open check (`mapDocument !== null`).
- Root JSON object check (currently required by existing Delete/Clone logic).
- Transaction constraints:
  - non-empty command list
  - max commands per transaction (bounds for L05)

#### Error handling
Reuse `MapEditError` but add transaction-specific codes:

```ts
export type MapEditError = Readonly<{
  kind: 'map-edit-error';
  code:
    | 'map-edit/no-document'
    | 'map-edit/invalid-json'
    | 'map-edit/unsupported-target'
    | 'map-edit/transaction-empty'
    | 'map-edit/transaction-too-large'
    | 'map-edit/transaction-step-failed';
  message: string;
  stepIndex?: number;
  cause?: MapEditError; // optional, only when step-failed wraps a nested error
}>;
```

No partial apply invariant:
- By construction: only one store write on success.

### C) Undo/redo model

#### Where stacks live
- Main process only, owned by the maps subsystem (application layer).
- Stored alongside AppStore state (recommended) or in a dedicated `MapHistoryService` that is created with the main process and keyed by the currently-open document.

Recommendation: store in AppStore (so renderer can derive menu enablement from state snapshot without extra IPC).

#### What is stored per step (design choice: Hybrid)
Choose **Option 4: Hybrid**:
- For the current atomic commands (Delete/Clone), store an *inverse record* that is guaranteed to restore exact JSON:
  - Delete: store the removed value and its precise reinsertion location (array path + index, or object key), not a lossy reconstruction.
  - Clone: store the ref created by clone; inverse is delete that exact created element.
- Add a **snapshot fallback** for cases where the engine cannot produce a safe inverse (future-proofing), but keep it bounded.

Undo record shape (main-only):
```ts
type MapHistoryEntry = Readonly<{
  label?: string;
  before: Readonly<{ json: unknown; dirty: boolean; lastValidation: MapValidationRecord | null }>;
  after: Readonly<{ json: unknown; dirty: boolean; lastValidation: MapValidationRecord | null }>;
  selectionAfter: MapEditSelectionEffect;
}>;
```

This is a pragmatic snapshot-at-boundaries approach:
- It guarantees exact prior JSON (hard requirement).
- It makes undo/redo deterministic and simple.

Resource mitigation (L05):
- Keep a bounded max depth (e.g., `MAX_HISTORY = 100`), configurable constant.
- Additionally cap by approximate serialized size (optional) and evict oldest.

If memory pressure is a concern, the Builder can refine to store `before.json` only (and recompute `after` by reapplying forward command), but the simplest correct v1 is storing `before` + `after` and bounding depth.

#### Redo invalidation
- On any successful edit (including transaction), push to undo stack and clear redo stack.

#### Interaction with `dirty` and `lastValidation`
- Any successful edit sets `dirty: true` and sets `lastValidation: null` (edit invalidates prior validation record).
- Undo/redo restores the entire prior document metadata:
  - Undo restores `dirty` and `lastValidation` exactly to `before`.
  - Redo restores them exactly to `after`.

#### Determinism
- Do not store timestamps in history entries unless sourced from injected `nowIso` and restored exactly.
- `label` must not affect behavior.

### D) IPC / UI integration plan

#### Minimal IPC additions
Keep existing `nomos:map:edit` and add two narrow channels:
- `nomos:map:undo`
- `nomos:map:redo`

IPC shapes (shared):
```ts
export const NOMOS_IPC_CHANNELS = {
  // ...existing
  mapUndo: 'nomos:map:undo',
  mapRedo: 'nomos:map:redo'
} as const;

export type MapUndoRequest = Readonly<{ steps?: number }>; // default 1
export type MapUndoResponse = Result<MapEditResult, MapEditError>;

export type MapRedoRequest = Readonly<{ steps?: number }>; // default 1
export type MapRedoResponse = Result<MapEditResult, MapEditError>;
```

Alternative (even smaller surface): represent undo/redo as commands inside `map-edit/transaction` is possible, but it blurs responsibilities; dedicated channels keep intent clear.

#### Renderer triggers + selection updates
- Renderer continues to call `window.nomos.map.edit({ command })` for normal actions.
- Toolbar/actions that represent composite edits send a single `map-edit/transaction`.
- Renderer updates `mapSelection` based solely on `MapEditResult.selection`:
  - `keep` => no change
  - `clear` => set selection null
  - `set` => set selection to the referenced element
  - `remap` => if current selection matches `from`, switch to `to` (no heuristics)

#### Menu + keyboard shortcuts
- Add menu items: Edit > Undo / Redo.
- Enable/disable is derived from AppStore snapshot fields (history info):
  - Disabled when no map is open.
  - Disabled when `canUndo/canRedo` false.

Where to expose enablement:
- Extend the state snapshot with a `mapHistory` summary:
```ts
type AppStateSnapshot = Readonly<{
  // ...existing
  mapHistory: Readonly<{ canUndo: boolean; canRedo: boolean; undoDepth: number; redoDepth: number }>;
}>;
```

### E) Testing plan
Main-process unit tests (Jest) must cover all conditional paths (L04):

1) Command application
- Delete success for each target kind.
- Clone success for each target kind.
- Unsupported command kind returns error.
- No document returns error.
- Invalid root JSON (non-object) returns error.

2) Transaction atomicity
- Transaction with multiple commands applies all or none.
- Failure at step `i` returns `transaction-step-failed` with `stepIndex: i`.
- Ensure store not mutated on any error path.

3) Undo/redo correctness
- Delete then undo restores exact prior JSON + metadata.
- Clone then undo restores exact prior JSON.
- Undo then redo returns exact post-edit JSON.
- Redo invalidated when a new edit occurs after undo.

4) Lifecycle
- Open map clears undo/redo stacks.
- Save does not clear stacks (decision: keep history across save) OR does (if preferred)—must be explicitly decided and tested.

5) Selection reconciliation
- Delete command returns `selection/clear` when deleting the selected ref.
- Clone returns `selection/set` to new ref.
- Transaction returns deterministic selection effect.

### F) Migration plan
- Keep `window.nomos.map.edit` as the primary entrypoint.
- Refactor `MapEditService.edit(command)` internally to:
  - normalize `command` to a transaction (single command => transaction of length 1)
  - delegate to new engine/history system
  - return the new `MapEditResult` shape
- Renderer toolbar can be updated in the same change to consume the new `selection` effect shape.

Backwards compatibility strategy:
- If needed, temporarily allow `MapEditResponse` to return either the old result union or the new `map-edit/applied` envelope.
- Prefer an “atomic cutover” in one PR: update renderer + preload types together.

## Acceptance criteria
- Commands:
  - `map-edit/transaction` exists and is typed in shared IPC.
  - Applying an atomic command or a transaction is deterministic and produces explicit selection reconciliation.
- Atomicity:
  - Any failing transaction does not mutate `AppStore.mapDocument`.
- Undo/redo:
  - Undo/redo stacks live in main and are bounded.
  - Undo restores the exact prior `MapDocument.json` and related metadata (`dirty`, `lastValidation`).
  - Redo invalidates on any new successful edit.
- IPC:
  - Minimal additions: only `nomos:map:undo` and `nomos:map:redo` (plus transaction kind in existing edit command).
  - Menu enablement derived from AppStore snapshot (no renderer heuristics).
- Tests:
  - Unit tests added/updated for every new/changed public method; all branch paths covered.
- Docs:
  - `docs/maps-system.md` and `docs/ipc-system.md` updated to describe new contract and history behavior.

## Risks / notes
- Snapshot-based history can increase memory usage; this Phase mandates bounded history depth and optionally size caps (L05).
- Keeping `MapDocument.json` as `unknown` restricts generic diffing; the plan avoids requiring a full JSON patch engine.
- Selection reconciliation is limited to `MapEditTargetRef` kinds; renderer must treat other selection kinds as unaffected/cleared as dictated by results.
