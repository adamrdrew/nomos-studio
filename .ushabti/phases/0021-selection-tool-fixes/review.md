# Phase 0021 — Review

## Summary

- The implementation introduces a pure picking API (`pickMapSelection`) and uses it for both click-selection and hover-preview selection.
- The textured-mode failure mode (“click visible wall strip but select sector”) is addressed by treating points inside rendered wall strip polygons as a wall hit.
- Hover preview is implemented in Select mode as a yellow outline, rendered beneath the existing red active-selection outline.

## Verified

- **L03 (Electron security):** Renderer-only changes; no preload/IPC surface changes observed.
- **L08 (Design for testability):** Picking logic is extracted into a deterministic, side-effect-free function in `src/renderer/ui/editor/map/mapPicking.ts`.
- **Acceptance: hover matches click selection:** `MapEditorCanvas` calls `pickMapSelection` in both `onMouseDown` (selection) and `onMouseMove` (hover), so hover preview matches click selection for the same pointer location by construction.
- **Acceptance: textured-mode walls:** `pickMapSelection` considers `texturedWallPolygons` when `renderMode === 'textured'`, and selects a wall when the point is inside the strip polygon.
- **L09 (Docs):** `docs/renderer-ui-system.md` now describes hover preview and textured-mode polygon picking.
- **Type safety:** No TS errors reported for the modified/new renderer files.

## Issues

- **Acceptance criteria requires manual UX verification:** the Phase definition expects in-app confirmation that (a) small walls near other walls/boundaries select the wall and (b) sector selection remains feasible; this evidence is not yet recorded.

## Required follow-ups

- S011 — Record manual UX verification evidence for acceptance criteria.

## Decision

- **NOT GREEN.** Phase status set back to `building` until S010 and S011 are completed and reviewed.

