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

- **L04 (Testing):** `pickMapSelection` has unit tests covering the priority order and the key conditional paths including: particle/light marker hits, textured mode with and without strip polygons, invalid door→wall references (skipped safely), and the null return case.
- **Manual UX verification (2026-01-21):** Verified in-app that selection and hover behavior matches the acceptance criteria: small walls near boundaries select the wall (not the sector), sector selection still works when clicking well inside, and the yellow hover outline matches click selection and clears off-object.

## Issues

None.

## Required follow-ups

None.

## Decision

- **GREEN.** The work has been weighed and found complete.

