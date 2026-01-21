# Phase 0017 Review — Map Editor View Overlays (Portals, Selection, Doors)

## Summary
Added snapshot-driven Map Editor view overlays: portal highlighting (wireframe + textured), red selection outlines for all selection kinds, and a textured-only door visibility toggle. View menu includes the new toggles and docs were updated.

## Verified
- View → Highlight Portals toggles portal visuals in wireframe and textured mode.
- Selected wall/sector/door/entity/light/particle renders with a red, non-scaling outline.
- View → Toggle Door Visibility hides/shows door markers in textured mode (wireframe unchanged).
- Tests/typecheck/lint pass.

## Issues
None observed.

## Required follow-ups
- Overseer review.

## Decision
