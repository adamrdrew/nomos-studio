# Review — Phase 0030 (Drag Entities to Map)

## Summary
Phase intent is fulfilled: the renderer has an Entities browser panel fed by the entity manifest, supports thumbnails and drag payloads, and enables sector-only drag/drop placement onto the map via a single undoable `map-edit/create-entity` edit.


## Verified
- Laws read: `.ushabti/laws.md`.
- Style read: `.ushabti/style.md`.
- Phase artifacts read: `phase.md`, `steps.md`, `progress.yaml`.

- Acceptance criteria:
	- Entities tab exists as a peer to Inspector and is non-closable.
	- Entities list is driven by the manifest (manifest-only), with thumbnail + entity `name` + `sprite.file.name` per row.
	- UI is resilient to missing/invalid files (stable placeholder/errors; no crash).
	- Dragging over map enforces sector-only drops (invalid outside sectors; valid inside sectors).
	- Valid drop appends `entities[]` with `{x,y,def,yaw_deg}` and selects the newly created entity.
	- Entity placement is a single undoable edit.
	- Asset refresh triggers Entities list reload.

- Laws/style compliance spot-check:
	- L03: renderer uses preload IPC (`window.nomos.assets.readFileBytes`, `window.nomos.map.edit`) for privileged operations.
	- L04: new exported helpers and new command paths have unit coverage across conditional branches.
	- L05: blob URLs created for thumbnails are revoked.
	- L09: renderer UI docs and map-edit command docs reflect the implemented behavior.

- Automated gates are expected green: `lint`, `typecheck`, and `jest`.
	- Verified in this review pass: `npm run lint`, `npm run typecheck`, and `npm test -- --runInBand` all pass.


## Issues
None.


## Required follow-ups
None.


## Decision
Phase 0030 is **green**. The work has been weighed and found complete.

