# Phase 0016 — Map Editor Rendering Improvements (Textured Walls)

## Intent
Fix textured-mode wall rendering in the Map Editor so it matches the map’s geometric reality: walls render as physically plausible solid strips that meet cleanly at corners and do not overlap in odd ways.

This Phase exists now because current wall strips are drawn as per-wall axis-aligned rectangles in wall-local coordinates, centered on the wall centerline and terminated with square end-caps at the wall endpoints. That produces (a) visible gaps at corners and (b) overlaps at joints, and it diverges from how the map’s boundary geometry should behave. This will become a correctness problem as we add geometry editing features.

> Note: The user request called this “phase 0015”, but `.ushabti/phases/0015-door-properties-editor/` already exists and is complete; by project convention Phase IDs are sequential, so this work is recorded as Phase **0016**.

## Scope

### In scope

#### A) Textured wall geometry: mitered joins and full-length coverage
- Replace the current “rectangle centered on wall line” approach with a join-aware wall strip construction so that:
  - Adjacent walls meeting at a vertex share the same join points.
  - Corners are clean (no visible gaps) and do not produce area overlap between adjacent wall strips.
  - Wall strips cover the full intended extent of the wall boundary as authored.

#### B) Corner handling rules (physically plausible)
- Implement deterministic join behavior at shared vertices:
  - Prefer **miter joins** for typical convex/concave corners.
  - Apply a **miter limit** (fallback to bevel) for extremely acute angles to avoid huge spikes.
  - Handle degenerate walls (zero-length) safely by skipping them.

#### C) Maintain existing textured-mode rendering fundamentals
- Preserve current textured-mode rules that are already correct and user-visible:
  - Screen-space wall thickness (constant-ish pixels on screen via `px / view.scale`).
  - Texture tiling behavior (fixed world-units-per-tile via `TEXTURE_TILE_WORLD_UNITS`).
  - “While texture missing/loading” fallback to wireframe segment.
  - 1px-ish outline stroke compensation by `1 / view.scale`.

#### D) Tests for geometry helpers
- Extract the join-aware geometry computation into a small, testable module and add unit tests that cover conditional paths and edge cases.

### Out of scope
- Changing the map file format.
- Changing map validation/runtime behavior.
- Adding new IPC/preload surface (renderer-only rendering change).
- Reworking sector floor rendering, triangulation, or polygon clipping beyond what is necessary to compute wall strip joins.
- Reinterpreting gameplay semantics (e.g., portals vs solid walls). This Phase treats the wall list as the source of truth for what “a wall” is; it only improves *how* it is drawn.

## Constraints
- **L01 (Cross-platform parity):** No renderer changes that behave differently per-OS; no OS-specific APIs.
- **L03 (Electron security):** Rendering stays renderer-local; do not widen preload/IPC.
- **L04 (Testing):** Any new/changed public method must have unit tests that cover conditional paths.
- **L08 (Design for testability):** Geometry logic must be separated from React/Konva so it can be unit-tested deterministically.
- **L09 (Docs):** Update `docs/renderer-ui-system.md` if the textured wall rendering rules/invariants described there become inaccurate.
- Style guide:
  - Keep rendering mechanics in renderer UI; keep pure geometry logic in small focused modules.
  - Avoid adding dependencies unless clearly necessary.

## Assumptions (explicit)
- Map walls are line segments between vertices (`v0` → `v1`), and the editor’s textured wall “thickness” is purely a visualization aid.
- The editor should render walls without relying on implicit wall ordering in the JSON; join computation must use explicit connectivity (shared vertices / sector loop adjacency).
- A small amount of floating point tolerance (epsilon) is acceptable in join comparisons.

## Acceptance criteria

### Geometry correctness (textured mode)
- For a simple rectangle room (4 walls), textured walls meet at all 4 corners with:
  - no visible gaps (“cut-off corners”)
  - no overlapping double-thickness blobs at corners
- For at least one concave corner case, the join remains stable (no spikes), and walls do not overlap adjacent wall strips.
- Wall strips visually appear “full length” (the strip reaches the corner join rather than stopping short).

### Rendering behavior preserved
- Texture tiling remains stable at varying zoom (no stretching regressions).
- Wall thickness remains approximately constant in screen pixels across zoom.
- When a wall texture image is missing/loading, the wall still renders as a wireframe segment.

### Safety + performance
- No crashes or infinite loops on malformed maps (missing vertices, broken sector loops, zero-length segments).
- Rendering remains responsive for typical map sizes; geometry computation is bounded and does not grow unreasonably with zoom/pan.

### Tests + quality gates
- Unit tests exist for the extracted geometry helper(s) and cover:
  - typical convex corner join
  - concave corner join
  - near-collinear join behavior
  - degenerate (zero-length) wall handling
  - miter-limit fallback
- `npm test`, `npm run typecheck`, `npm run lint` pass.

### Manual verification
- Open a known-problem map and confirm in textured mode:
  - walls do not overlap oddly
  - corners are clean (no gaps)
  - textured walls match wireframe topology

## Risks / notes
- Join-aware rendering requires consistent adjacency discovery. If the map contains non-manifold geometry (multiple walls meeting at one vertex in a way that isn’t a simple loop), we must pick a deterministic fallback (e.g., bevel joins or per-wall capped strips) rather than crash.
- Miter joins can create extreme spikes at very acute angles; a miter limit is required.
- Because wall thickness is screen-space, join points are scale-dependent; the computation must be efficient enough to run as zoom changes.
