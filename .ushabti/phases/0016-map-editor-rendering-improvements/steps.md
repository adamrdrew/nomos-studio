# Phase 0016 Steps — Map Editor Rendering Improvements (Textured Walls)

## S001 — Confirm current behavior and collect repro cases
- **Intent:** Make the problem concrete and ensure fixes target real authored maps.
- **Work:**
  - Identify 1–3 representative maps that show:
    - corner gaps (“cut outs”) in textured mode
    - odd overlaps at joints
  - Record expected visuals (screenshots or brief notes) for before/after comparison.
  - Locate the current textured wall rendering code path in `MapEditorCanvas` and describe precisely how it constructs wall shapes.
- **Done when:** There are named repro maps and a short write-up of the current algorithm and failure modes.

## S002 — Define the join model and invariants
- **Intent:** Decide exactly what “physically plausible” means for editor wall strips.
- **Work:**
  - Define a join strategy for walls meeting at a vertex:
    - default miter join
    - bevel fallback when miter exceeds a configured limit
  - Define numeric tolerances (epsilon) for near-collinear edges.
  - Define deterministic behavior for non-manifold vertices (more than 2 adjacent boundary edges).
- **Done when:** The join rules are written down and can be implemented without ambiguity.

## S003 — Extract pure geometry helpers for wall strip construction
- **Intent:** Make the new behavior testable and keep React/Konva code focused on drawing.
- **Work:**
  - Introduce a small module (renderer-local) that:
    - accepts wall endpoints and a thickness in world units
    - computes per-wall strip polygons/quads with join-aware endpoints
    - exposes minimal, typed outputs suitable for Konva `Shape.sceneFunc`
  - Keep the module free of Konva/DOM dependencies.
- **Done when:** Geometry computation is isolated in one module with a narrow API.

## S004 — Unit tests for the geometry helpers
- **Intent:** Satisfy L04/L08 and prevent regressions in corner cases.
- **Work:**
  - Add Jest unit tests covering:
    - square loop: adjacent walls share join points; no gaps at corners
    - concave corner: stable join without overlap artifacts
    - near-collinear: avoids numeric explosion, produces sensible join
    - degenerate wall: skipped safely
    - miter limit: bevel fallback engages
  - Ensure all conditional branches in public helper APIs are covered.
- **Done when:** Tests pass and clearly exercise the join rules.

## S005 — Integrate join-aware geometry into textured wall rendering
- **Intent:** Replace the centered-rectangle approach with join-aware polygons.
- **Work:**
  - Update `MapEditorCanvas` textured wall drawing to use the geometry helper output.
  - Preserve current texture tiling behavior and outline stroke compensation.
  - Preserve missing-texture fallback behavior.
- **Done when:** Textured walls render via join-aware polygons and existing behaviors remain intact.

## S011 — Prevent inter-sector overlap (one-sided wall rendering)
- **Intent:** In textured mode, prevent walls from visually overlapping where sectors butt up against each other.
- **Work:**
  - Adjust wall strip geometry so wall thickness is rendered on the interior side of the wall for the owning sector boundary loop, rather than centered on the centerline.
  - Ensure shared boundaries render without overlap by offsetting each sector’s wall strip into that sector’s interior.
  - Preserve clean joins at corners (miter + limit) for the offset-side edge.
- **Done when:** Textured walls do not overlap across adjacent sectors; rooms and boundaries read clearly.

## S012 — Tests: one-sided interior offset invariants
- **Intent:** Satisfy L04 for the new conditional paths introduced by one-sided strips and make the adjacent-sector non-overlap rule verifiable.
- **Work:**
  - Add unit tests for `computeTexturedWallStripPolygons` that cover:
    - CW vs CCW sector loop winding (area < 0 branch) produces an inward offset in the correct direction.
    - An adjacent-sector scenario (two sectors sharing a boundary via duplicated walls, one per sector) yields offset strips that do not overlap (offsets go to opposite sides of the shared centerline).
  - Optionally add a minimal `docs/repro-maps/0016-adjacent-sectors.json` fixture so the adjacent-sector case is easy to manually verify.
- **Done when:** The new tests pass and explicitly exercise the previously-uncovered branches/invariants.

## S006 — Validate selection/hit-testing ergonomics remain correct
- **Intent:** Ensure improved visuals do not degrade editor interaction.
- **Work:**
  - Confirm wall hit-testing continues to be segment-based and intuitive.
  - Confirm door markers remain visible and centered on their wall segment.
- **Done when:** Selecting walls/doors feels unchanged (or explicitly improved) from the user’s perspective.

## S007 — Handle malformed topology safely
- **Intent:** Avoid crashes on imperfect maps.
- **Work:**
  - Ensure missing vertices, zero-length segments, and broken adjacency do not throw.
  - Define and implement fallbacks (e.g., capped strip for that wall only).
- **Done when:** Rendering degrades gracefully without exceptions.

## S008 — Update subsystem documentation (L09)
- **Intent:** Keep renderer docs truthful as rendering invariants change.
- **Work:**
  - Update `docs/renderer-ui-system.md` to describe:
    - join-aware textured wall geometry
    - miter/bevel behavior and miter limit
    - any edge-case fallback rules
- **Done when:** Docs accurately reflect the new wall rendering model.

## S009 — Run quality gates
- **Intent:** Ensure the repo remains green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All commands pass.

## S010 — Manual verification pass
- **Intent:** Verify the fix visually and against real authoring workflows.
- **Work:**
  - Open the repro maps from S001 in textured mode.
  - Verify:
    - no odd overlaps
    - corners meet cleanly
    - walls appear full-length
    - zoom does not distort thickness/tiling
- **Done when:** Before/after comparison shows the issue resolved.
