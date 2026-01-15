# Review

## Summary

Phase 0009 delivers the transactional edit model, main-owned bounded undo/redo, typed IPC/preload surface, explicit selection reconciliation, and subsystem docs updates.

However, the Phase is not green yet because L04 (“every public method has unit tests covering all conditional paths”) is not fully satisfied: coverage indicates remaining untested branches in key public APIs (notably `MapCommandEngine.apply`, `MapEditHistory.recordEdit`, and `MapEditService.edit`).


## Verified

- **L03 security boundary:** Renderer interactions go through typed preload (`window.nomos.*`); privileged operations remain in main.
- **Transactional command model:** `map-edit/transaction` is present in shared IPC types and enforced in main engine.
- **Atomicity:** Engine computes on a cloned working JSON and only commits via a single `AppStore.setMapDocument` on success.
- **Undo/redo semantics:** History is main-owned, bounded, reset on open-map, and undo/redo restore `json`, `dirty`, and `lastValidation` exactly.
- **Menu enablement:** Derived from main snapshot `mapHistory` and used to enable/disable Undo/Redo.
- **Docs (L09):** Maps + IPC subsystem docs describe the new contract and invariants.
- **Build gates:** `npm run typecheck`, `npm run lint`, and `npm run test` pass.


## Issues

- **L04 branch coverage still not proven complete (needs re-run evidence):** The user’s latest `npm run test --coverage` output (Jan 13, 2026) still showed remaining uncovered lines in the maps subsystem:
	- `src/main/application/maps/MapCommandEngine.ts`: uncovered `80,92`.
	- `src/main/application/maps/MapEditHistory.ts`: uncovered `49`.
	- `src/main/application/maps/MapEditService.ts`: uncovered `107`.

Since that coverage run, additional tests and small refactors were made specifically to close those gaps (S013, S015, S017, S020, S021). A fresh coverage run is required to verify L04 and the Phase acceptance criteria are now satisfied.


## Required follow-ups

- Re-run `npm run test --coverage` and confirm the maps subsystem no longer reports uncovered lines/branches for:
- Complete follow-ups S021–S023 (and any earlier unimplemented coverage steps) and re-run `npm run test --coverage` to confirm the maps subsystem no longer reports uncovered lines/branches for:
	- `MapCommandEngine.apply` (including selection reconciliation branches)
	- `MapEditHistory.onMapOpened`
	- `MapEditService.edit/undo/redo` edge/loop branches
- If coverage is clean, mark S013, S015, S017, S018, S019, S020, S021 as `implemented: true`, then proceed to final Phase review.


## Decision

Not green. Phase remains `building` until a post-change `npm run test --coverage` run confirms L04 (all conditional paths through changed public methods) and the Phase acceptance criteria “Tests” section.

