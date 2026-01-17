# Phase 0011 — Move Entity Tool

## Intent
Enable moving a map **entity** in the editor by:
1) selecting an entity with the **Select** tool, then
2) switching to a new **Move** tool and dragging the selected entity to a new position.

The move must be applied via the existing main-process transactional map edit system so that:
- Undo/Redo (Edit menu) works, and
- saving the map persists the moved position.

## Scope

### In scope
- Add a new renderer tool: **Move**.
- Add a new IPC edit command variant for moving an entity:
  - a new `MapEditAtomicCommand` variant (e.g. `map-edit/move-entity`) that updates a single entity’s `x`/`y`.
- Implement the new command in main:
  - `MapCommandEngine` applies the move against a cloned JSON working copy.
  - `MapEditService` records history and updates `MapDocument` (`dirty`, `lastValidation`, and `revision` bump) on success.
- Renderer interaction behavior:
  - Move tool only operates when the current selection is `{ kind: 'entity', index }`.
  - Dragging provides a renderer-local preview, but only commits a single edit on mouse-up.
  - On stale revision errors, refresh snapshot and revert any preview.
- Tests for all public-method conditional paths impacted (L04).
- Update subsystem docs affected by new command + tool (L09).

### Out of scope
- Moving non-entity objects (lights, particles, doors, vertices, walls, sectors).
- Continuous “live” edits during drag (no per-mouse-move history spam).
- Snapping, constraints, axis locks, rotate handling, or keyboard modifiers.
- Multi-select or group movement.
- New menu items or shortcuts beyond existing undo/redo.

## Constraints
- L03 (Electron security): renderer must not mutate files/OS directly; all persistence and authoritative map mutation remains in main via typed IPC.
- L04 (Testing): changes to public APIs (including IPC-facing unions and main services) must be covered across success/failure/edge branches.
- L09 (Docs): update docs describing the IPC/map edit command model and renderer tool UX.
- Style guide:
  - Keep boundaries explicit (shared IPC contract vs main maps services vs renderer UI).
  - Avoid widening preload surface unnecessarily; reuse `window.nomos.map.edit`.

## Acceptance criteria
- A “Move” tool exists in the map editor toolbox alongside Select/Zoom/Pan.
- Workflow:
  - With a map open, Select tool can select an entity.
  - Switching to Move tool allows dragging the selected entity to a new location.
  - On mouse-up, the entity remains at the new position.
- Undo/Redo:
  - After moving, Undo restores the prior position.
  - Redo reapplies the move.
- Save:
  - After moving, saving and reopening the map preserves the new entity position.
- Stale-edit handling:
  - If the document revision is stale at commit time, the move is rejected atomically, the renderer refreshes, and no partial move persists.
- Tests:
  - Main unit tests cover `MapCommandEngine` behavior for move-entity (success and expected failure cases).
  - Main unit tests cover `MapEditService` integration aspects impacted by move (revision bump + history recording + metadata transitions).
- Docs:
  - `docs/map-edit-command-system.md` documents the new atomic command.
  - `docs/renderer-ui-system.md` documents the Move tool behavior at a high level.

## Risks / notes
- Renderer preview state must be strictly local and must not desync selection or snapshot refresh.
- JSON shape tolerance: existing entity entries may be malformed; move should fail with a typed error rather than mutating unexpectedly.
- Coordinate semantics: commit should write finite numbers; no implicit snapping is introduced in this Phase.
