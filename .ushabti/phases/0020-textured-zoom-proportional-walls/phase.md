# Phase 0020 — Textured Zoom: Proportional Wall Scaling

## Intent
Fix textured-mode zoom behavior in the Map Editor so **wall thickness scales with the rest of the map**, keeping wall/sector proportions visually consistent at any zoom.

This Phase exists now because textured walls currently use a screen-space thickness (constant-ish pixels on screen). When zoomed far out, sectors shrink but wall thickness does not, making walls look chunky and can render the map illegible for certain geometries.

## Scope

### In scope
- Change textured-mode wall rendering so wall thickness is defined in **world units** (or otherwise scales with view scale), so that:
  - zooming in/out scales **sectors and walls together**
  - the apparent proportion of wall thickness to sector geometry does not change due to zoom
- Keep existing textured rendering fundamentals intact:
  - texture tiling remains world-space (`TEXTURE_TILE_WORLD_UNITS` behavior)
  - join-aware strip polygons remain in use (no regression to per-wall rectangles)
  - missing/unloaded wall textures still fall back to wireframe wall segments
- Update documentation under `docs/` if the renderer wall thickness rules become inaccurate.

### Out of scope
- Wireframe mode wall thickness rules.
- Marker sizing rules (doors/entities/lights/particles) staying screen-space.
- Changing map file format, validation, or any main/preload/IPC surface.
- Introducing new render modes or reworking texture loading.

## Constraints
- **L01 (Cross-platform parity):** Renderer behavior must be consistent across macOS/Windows/Linux.
- **L03 (Electron security):** Renderer-only change; do not widen preload/IPC.
- **L04 (Testing):** Any new/changed public method must have unit tests covering conditional paths.
- **L08 (Design for testability):** If helpers are introduced, keep them pure and deterministic.
- **L09 (Docs):** Update `docs/renderer-ui-system.md` if its “wall thickness rules” section becomes inaccurate.

## Assumptions (explicit)
- The desired behavior is: **textured wall strip thickness scales with zoom**, i.e. a constant wall thickness in world units (or equivalent) rather than constant pixels.
- Maintaining selection ergonomics is still important; selection/hit testing can remain screen-space based even if wall rendering scales.

## Acceptance criteria

### Visual correctness (textured mode)
- At a wide range of zoom levels (including very zoomed out), textured walls do not become disproportionately thick relative to sectors; the map remains legible.
- Relative proportions between:
  - wall strip thickness and nearby sector geometry
  - wall strip thickness and texture tile size
  remain stable across zoom.

### Verifiable implementation invariant
- In textured mode, the wall strip thickness used for rendering does **not** vary with `view.scale` (i.e., no `px / view.scale` style conversion for textured wall thickness).

### No regressions to existing textured behavior
- Texture tiling remains stable across zoom (no stretching).
- Join-aware corners remain clean (no new gaps/overlaps at corners).
- Missing/unloaded wall textures continue to render using the wireframe fallback segment.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.

## Risks / notes
- Textured walls were previously screen-space thick to keep wall textures visible. Moving to world-space thickness may make walls thin at extreme zoom-out; this is acceptable and desired for legibility.
- If a minimum pixel thickness clamp is introduced, it would reintroduce a proportion change at extremes; avoid clamps unless explicitly requested.
