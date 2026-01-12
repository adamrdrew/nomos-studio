# Steps — Phase 0009

## S001 — Inventory current edit + store patterns
- **Intent:** Ensure the new command engine integrates without breaking invariants.
- **Work:** Identify current `MapEditService`, `AppStore.setMapDocument`, IPC wiring, and renderer selection update points.
- **Done when:** A short note exists in the PR/Phase notes listing the concrete call sites to update.

## S002 — Define shared command + result types (IPC-facing)
- **Intent:** Establish a narrow, typed contract for transactional edits and selection reconciliation.
- **Work:** Update shared types:
  - Add `MapEditAtomicCommand` and extend `MapEditCommand` with `map-edit/transaction`.
  - Define `MapEditSelectionEffect` and `MapEditHistoryInfo`.
  - Update `MapEditResult` to the new envelope (or define `MapEditResultV2` during migration).
  - Extend `MapEditError` with transaction-related codes.
- **Done when:** Typecheck passes and IPC types express transactions + selection effects + history info.

## S003 — Decide and document history metadata semantics
- **Intent:** Make undo/redo behavior explicit and testable (dirty + lastValidation semantics).
- **Work:** Decide:
  - edits set `dirty: true` and clear `lastValidation`.
  - undo/redo restores metadata exactly.
  - whether save clears redo/undo (default: does not).
- **Done when:** Decision is recorded in `docs/maps-system.md` update plan and reflected in acceptance criteria/tests.

## S004 — Implement main command engine API (pure-ish)
- **Intent:** Separate transform logic from store mutation.
- **Work:** Create a `MapCommandEngine` (or equivalent) that:
  - takes current `MapDocument` + `MapEditCommand`
  - evaluates on a working copy
  - returns `{ nextJson, selectionEffect, historyDelta }` or a typed error
  - does not mutate `AppStore`
- **Done when:** Engine has unit tests covering success + failure branches for atomic commands and transactions.

## S005 — Implement bounded undo/redo history (main)
- **Intent:** Provide deterministic undo/redo without resource leaks.
- **Work:** Add a history component (service or store field) that:
  - stores bounded stacks (max depth)
  - pushes entries on successful edits
  - clears redo on new edit
  - clears both stacks on open map
  - returns `MapEditHistoryInfo` for UI enablement
- **Done when:** Unit tests cover stack behavior, bounds, invalidation, and open-map reset.

## S006 — Wire MapEditService through engine + history
- **Intent:** Preserve the existing public entrypoint while upgrading internals.
- **Work:** Refactor `MapEditService.edit` to:
  - normalize to transaction
  - call engine
  - commit via a single `store.setMapDocument` on success
  - update history and return new `MapEditResult`
- **Done when:** Existing tests are updated and new tests prove “no partial apply” and correct metadata updates.

## S007 — Add IPC channels for undo/redo (minimal surface)
- **Intent:** Allow renderer/menu to invoke undo/redo without widening general edit APIs.
- **Work:** Add channels + typed preload methods:
  - `window.nomos.map.undo()` and `window.nomos.map.redo()` (or `undo({steps})` / `redo({steps})`).
  - Register handlers in `registerNomosIpcHandlers` and main handler object.
- **Done when:** IPC handler tests confirm wiring and typed contracts.

## S008 — Expose history summary in state snapshot for enable/disable
- **Intent:** Enable renderer/menu state without extra IPC calls.
- **Work:** Extend `AppStateSnapshot` to include `mapHistory` (canUndo/canRedo/depths).
- **Done when:** Renderer store snapshot includes the new fields and no callers break.

## S009 — Renderer integration: selection reconciliation + undo/redo triggers
- **Intent:** Ensure selection updates are driven by explicit main results.
- **Work:** Update renderer to:
  - interpret `MapEditResult.selection` and update `mapSelection` accordingly
  - call `window.nomos.map.undo/redo` for shortcuts/menu
  - use snapshot `mapHistory` to enable/disable menu items
- **Done when:** Manual smoke checks succeed: delete/clone, undo/redo, redo invalidation.

## S010 — Menu + shortcuts
- **Intent:** Provide user-facing access via standard UI affordances.
- **Work:** Add Edit > Undo/Redo menu items and keyboard accelerators; enablement derived from snapshot.
- **Done when:** Undo/Redo appear and are disabled/enabled correctly as map/hist state changes.

## S011 — Test matrix completion (main)
- **Intent:** Satisfy L04 with full conditional path coverage.
- **Work:** Add/extend unit tests for:
  - delete then undo
  - clone then undo
  - batch/transaction success
  - redo invalidation after new edit
  - open map clears history
  - error paths do not mutate store
- **Done when:** `npm test` passes and coverage includes the new public APIs’ branches.

## S012 — Documentation updates (L09)
- **Intent:** Keep subsystem docs consistent with new behavior.
- **Work:** Update:
  - `docs/maps-system.md` (transaction, undo/redo semantics, dirty/lastValidation)
  - `docs/ipc-system.md` (new channels + request/response shapes)
- **Done when:** Docs reflect the new public contract and invariants.
