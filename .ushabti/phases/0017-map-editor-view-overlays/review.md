# Phase 0017 Review — Map Editor View Overlays (Portals, Selection, Doors)

## Summary
Added snapshot-driven Map Editor view overlays: portal highlighting (wireframe + textured), red selection outlines for all selection kinds, and a textured-only door visibility toggle. View menu includes the new toggles and docs were updated.

## Verified
- View → Highlight Portals toggles portal visuals in wireframe and textured mode.
- Selected wall/sector/door/entity/light/particle renders with a red, non-scaling outline.
- View → Toggle Door Visibility hides/shows door markers in textured mode (wireframe unchanged).
- State wiring is main-owned (`AppStore`) → snapshot (`AppStateSnapshot`) → renderer store (`useNomosStore`) and menu checked states reflect snapshot fields (L03).
- Public API changes have unit tests covering conditional paths (L04).
- Docs updated for Menu System and Renderer UI System (L09).
- `npm test` / `npm run typecheck` / `npm run lint` pass. (Note: lint emits an upstream TypeScript version support warning from `@typescript-eslint` but exits 0.)

## Issues
None observed.

## Required follow-ups
None.

## Decision
GREEN — Phase 0017 is complete. The work has been weighed and found complete.
