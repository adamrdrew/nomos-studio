# Phase 0008 Review — Tool Bar

## Summary

Phase intent is implemented and quality gates are green, and the earlier Zoom focus and tool-registry test gaps have been addressed. However, this Phase is still not approved because L04 requires unit tests covering all meaningful conditional paths through new public APIs, and `MapEditService` still contains unexercised conditional branches per the Jest coverage report.

## Verified

- Tool bar exists above the Map Editor canvas and does not overlap the toolbox overlay (renderer layout is a column with toolbar then canvas region).
- Tool bar contents are driven by a typed tool-definition registry (Map Editor tools declare their toolbar commands; toolbar rendering iterates the registry).
- Select tool shows Delete/Clone; Zoom tool shows Zoom In/Out/Default Zoom; Pan tool shows Center (as declared in the registry).
- Map edits are requested via typed preload/IPC (`window.nomos.map.edit` → `nomos:map:edit`) and main-process mutation occurs via `MapEditService` with `dirty: true`.
- Renderer refresh path after edits is present: `AppStore.setMapDocument(...)` emits; main subscribes and sends `nomos:state:changed`.
- Quality gates are reported green by the user (`npm test`, `npm run typecheck`, `npm run lint`).

## Issues

### Law L04 — Remaining untested conditional paths in MapEditService

Jest coverage still reports uncovered conditionals inside `MapEditService`, including (at minimum):
- `cloneIndexedWithOffset`: error propagation when the collection is not an array, and the `source === undefined` not-found branch.
- `deleteDoorById` / `cloneDoorById`: error propagation when `doors` is not an array, and handling of non-record entries in the `doors` array.
- `ensureUniqueDoorId`: the loop case where multiple collisions require incrementing beyond `-copy-2`.
- `asRecord` failing branch (reachable via cloning an indexed entry that is not an object).

This remains a hard fail under L04 until either:
- tests cover these meaningful branches, or
- unreachable/dead branches are removed/refactored (so the remaining conditionals are all meaningful and covered).

## Required follow-ups

- Add the remaining `MapEditService` unit tests (or refactor dead branches) so all meaningful conditional paths are covered.

## Decision

Not approved. Phase status must return to **building** until the above follow-ups are completed and re-reviewed.

