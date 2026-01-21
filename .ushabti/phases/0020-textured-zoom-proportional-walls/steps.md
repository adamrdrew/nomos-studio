# Phase 0020 Steps — Textured Zoom: Proportional Wall Scaling

## S001 — Reproduce and bound the problem
- **Intent:** Make the chunky-wall failure mode concrete and pick verification maps.
- **Work:**
  - Use the existing repro maps under `docs/repro-maps/` (from Phase 0016) and identify at least one additional “illegible when zoomed out” real map if available.
  - Capture a brief before-state note: which zoom range triggers chunkiness and which geometry is affected.
- **Done when:** A short list of repro maps + zoom ranges is recorded for manual verification.

## S002 — Locate the textured wall thickness rule in the renderer
- **Intent:** Ensure the change is surgical and doesn’t affect other zoom behaviors.
- **Work:**
  - Locate where `MapEditorCanvas` converts pixel sizes to world sizes (notably `texturedWallThicknessPx / view.scale`).
  - Identify any other compensations related to wall outlines/strokes that could also create “chunky at zoom-out” artifacts.
- **Done when:** The exact code path(s) responsible for textured wall thickness scaling are identified.

## S003 — Decide the world-space thickness invariant
- **Intent:** Make the new thickness rule explicit and stable.
- **Work:**
  - Define textured wall thickness in world units.
  - Prefer deriving it from existing world-space constants (e.g., as a ratio of `TEXTURE_TILE_WORLD_UNITS`) so the wall-to-texture proportion is stable.
- **Done when:** A single, explicit rule exists (e.g., `TEXTURED_WALL_THICKNESS_WORLD = TEXTURE_TILE_WORLD_UNITS * k`).

## S004 — Implement proportional thickness in textured mode
- **Intent:** Make walls scale with sectors when zooming.
- **Work:**
  - Update textured wall rendering to use the world-space thickness invariant directly (remove/avoid screen-space conversion for wall thickness).
  - Ensure join-aware wall strip geometry continues to receive thickness in world units.
- **Done when:** Zooming in/out changes wall thickness on-screen proportionally with the rest of the map.

## S005 — Confirm selection/hit-testing remains usable
- **Intent:** Prevent interaction regressions.
- **Work:**
  - Verify wall hit-testing remains intuitive at both high and low zoom.
  - If necessary, adjust hit-test thresholds (still screen-space) without reintroducing visual thickness scaling.
- **Done when:** Selecting walls/doors is not noticeably harder at extreme zoom levels.

## S006 — Update docs (L09)
- **Intent:** Keep subsystem documentation accurate.
- **Work:**
  - Update `docs/renderer-ui-system.md` “Wall thickness rules” to reflect the new textured-mode scaling rule.
- **Done when:** The docs no longer claim textured wall thickness is screen-space constant.

## S007 — Run quality gates
- **Intent:** Keep the repo green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All commands pass.

## S008 — Manual verification pass
- **Intent:** Confirm the fix addresses the real UX issue.
- **Work:**
  - In textured mode, zoom from max zoom-out to max zoom-in on the repro maps.
  - Confirm walls never become “chunky blobs” at far zoom-out and map remains readable.
- **Done when:** Before/after notes show the proportional-scaling issue is resolved.
