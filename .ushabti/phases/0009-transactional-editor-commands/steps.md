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

## S013 — Complete L04 branch coverage for MapCommandEngine
- **Intent:** Satisfy L04 for the public `MapCommandEngine.apply` method.
- **Work:** Add unit tests that cover remaining conditional paths:
  - `map-edit/transaction-empty`
  - `map-edit/transaction-too-large`
  - non-transaction (single atomic) apply path
  - transaction `label` propagation (label omitted vs present)
- **Done when:** Jest coverage for `MapCommandEngine.apply` reaches full branch coverage for its conditionals.

## S020 — Remove unreachable branch in MapCommandEngine target comparison
- **Intent:** Keep branch coverage meaningful and satisfy L04 when a defensive branch cannot be hit via public APIs.
- **Work:** Refactor `targetEquals` in `MapCommandEngine` to remove the unreachable `default` switch branch (return `false` for unknown kinds).
- **Done when:** Jest coverage no longer reports uncovered lines in `targetEquals`, and behavior for known target kinds is unchanged.

## S014 — Complete L04 branch coverage for MapEditHistory
- **Intent:** Satisfy L04 for the public `MapEditHistory.recordEdit` method.
- **Work:** Add a unit test for the `maxDepth === 0` behavior:
  - `recordEdit` clears both stacks and keeps history disabled.
- **Done when:** Jest coverage includes the `maxDepth === 0` branch and asserts redo invalidation behavior.

## S015 — Complete L04 branch coverage for MapEditService.edit edge/error paths
- **Intent:** Satisfy L04 for the public `MapEditService.edit` method.
- **Work:** Add unit tests for hard-to-hit branches via dependency injection:
  - engine success but clone result does not produce `selection/set` (expect `map-edit/invalid-json`), using a stub engine.
  - `cloneJsonOrError` failure path (non-cloneable JSON) and “no store mutation on error”.
  - unknown/unsupported command kind returns `map-edit/unsupported-target`.
- **Done when:** Jest coverage for `MapEditService.edit` includes these failure branches and asserts the store is unchanged.

## S016 — Complete remaining L04 branches in MapCommandEngine.apply (defensive paths)
- **Intent:** Fully satisfy L04 for the public `MapCommandEngine.apply` method.
- **Work:** Add unit tests that cover remaining conditional paths that are still present in the method:
  - structuredClone failure: when `MapDocument.json` is an object but not cloneable, `apply` returns `map-edit/invalid-json`.
  - undefined step defense: when a transaction’s `commands` contains an `undefined` element (e.g., sparse array), `apply` returns `map-edit/transaction-step-failed` with the correct `stepIndex`.
- **Done when:** Jest branch coverage for `MapCommandEngine.apply` includes these defensive branches.

## S017 — Complete L04 branch coverage for MapEditService.undo/redo step parsing
- **Intent:** Satisfy L04 for the public `MapEditService.undo` and `MapEditService.redo` methods.
- **Work:** Add unit tests covering conditional paths in request parsing and looping behavior:
  - `steps` omitted, non-finite, or `< 1` => defaults to 1 step.
  - `steps > 1` => loops multiple times and returns the final restore.
  - If any branches are unreachable by construction, refactor to remove dead conditionals so coverage requirements can be satisfied.
- **Done when:** Jest branch coverage for `MapEditService.undo` and `MapEditService.redo` includes all meaningful conditionals.

## S018 — Add direct unit coverage for MapEditHistory.onMapOpened
- **Intent:** Satisfy L04 expectations for the public `MapEditHistory.onMapOpened` method.
- **Work:** Add/adjust a unit test that:
  - records at least one edit,
  - calls `history.onMapOpened(document)` directly,
  - asserts `getInfo()` returns empty stacks and `undo/redo` return `map-edit/not-found`.
- **Done when:** Coverage no longer shows `MapEditHistory.ts` `onMapOpened` statements uncovered, and behavior is asserted.

## S021 — Remove dead statement in MapEditHistory.onMapOpened
- **Intent:** Keep production code clean and avoid coverage artifacts caused by side-effect-free statements.
- **Work:** Refactor `MapEditHistory.onMapOpened` to remove the `void document;` line (e.g., rename param to `_document` and call `this.clear()` directly).
- **Done when:** `onMapOpened` contains only meaningful work (`this.clear()`), with no `void` parameter statement.

## S022 — Cover remaining targetEquals branches in MapCommandEngine
- **Intent:** Satisfy L04 for all conditional paths exercised by `MapCommandEngine.apply` (including selection reconciliation).
- **Work:** Add unit tests that force `targetEquals` to take the remaining uncovered branches:
  - transaction delete with selection omitted or `selection.ref: null` (covers the `a === null` path)
  - transaction delete where selection ref kind differs from target kind (covers the `a.kind !== b.kind` path)
- **Done when:** Jest coverage no longer reports `MapCommandEngine.ts` uncovered lines 80 and 92.

## S023 — Cover MapEditService.edit afterState failure branch
- **Intent:** Satisfy L04 for all conditional paths in the public `MapEditService.edit` method.
- **Work:** Add a unit test that makes `afterState` fail (coverage reports `MapEditService.ts` line 107):
  - use a stub engine that returns `ok: true` but a `nextJson` that is not cloneable (causing `toDocumentState(nextDocument)` to fail)
  - assert it returns `map-edit/invalid-json` and does not mutate the store
- **Done when:** Jest coverage no longer reports `MapEditService.ts` uncovered line 107.

## S024 — Cover MapEditHistory constructor default parameter branch
- **Intent:** Satisfy L04 for MapEditHistory public construction paths.
- **Work:** Add a unit test that calls `new MapEditHistory()` with no args (coverage reports `MapEditHistory.ts` line 49).
- **Done when:** Jest coverage no longer reports `MapEditHistory.ts` uncovered line 49.

## S025 — Add dedicated documentation for the transactional map edit command system (L09)
- **Intent:** Ensure future development phases understand the command engine, transaction model, selection reconciliation, and undo/redo semantics.
- **Work:** Add a dedicated doc under `docs/` that explains:
  - command types and transaction wrapper
  - engine responsibilities and atomicity guarantees
  - selection reconciliation effects and when they are emitted
  - undo/redo history model and invariants (json/dirty/lastValidation)
  - how IPC/preload surfaces map to application services
  - extension guidance (how to add a new atomic edit safely)
- **Done when:** A new doc exists under `docs/` and `docs/maps-system.md` links to it.

## S019 — Complete command-application matrix tests required by phase.md
- **Intent:** Fulfill the Phase test-plan requirement for command application coverage.
- **Work:** Extend `MapCommandEngine` tests to include:
  - delete success for each target kind: light, particle, entity, door
  - clone success for each target kind: light, particle, entity, door
  - unsupported target kind and unsupported command kind return errors
- **Done when:** The command-application matrix is covered, and remaining uncovered lines/branches in the maps engine decrease accordingly.
