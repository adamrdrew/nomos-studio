# Phase 0017 — Map Editor View Overlays (Portals, Selection, Doors)

## Intent
Add three **view-layer** improvements to the Map Editor so authors can reason about connectivity and current focus:

1) **Highlight portals**: visually call out any wall that represents a portal (a wall with `back_sector > -1`) by rendering it in blue.
2) **Highlight selected object**: any object selected via the Select tool (wall/sector/door/entity/light/particle, etc.) renders with a red outline.
3) **Toggle door visibility**: allow hiding door markers in the Map Editor (textured mode only) via a View menu toggle.

This Phase exists now because the map canvas + View menu already support render-mode toggles and grid toggles; these features extend that same snapshot-driven state and rendering pipeline.

## Scope

### In scope

#### A) New view flags owned by main `AppStore`
- Add main-owned, snapshot-propagated view flags:
  - `mapHighlightPortals: boolean` (default `false`)
  - `mapDoorVisibility: 'visible' | 'hidden'` (default `'visible'`)
    - This flag only affects **textured** mode rendering; wireframe door markers remain unchanged.

#### B) View menu items
- Extend the existing View menu with:
  - **Highlight Portals** (checkbox)
    - Toggling updates `mapHighlightPortals` in main store.
    - Works in both wireframe and textured mode.
  - **Toggle Door Visibility** (checkbox)
    - Checked state reflects whether doors are hidden.
    - Toggling updates `mapDoorVisibility`.
    - Has an effect only when map render mode is `textured`.

#### C) Portal wall highlighting
- In both render modes:
  - Any wall with `backSector > -1` is rendered with a blue treatment.
  - The highlight must not change hit-testing semantics.

#### D) Selected-object outline highlighting
- For the current `mapSelection` in the renderer store:
  - Render a **red outline** around the selected object.
  - Supported selection kinds:
    - `wall`: highlight the wall segment/strip.
    - `sector`: highlight the sector boundary.
    - `door`: highlight the door marker at its referenced wall.
    - `entity`, `light`, `particle`: highlight the marker.
  - Outline should remain readable across zoom:
    - Use non-scaling stroke behavior consistent with existing marker/wall strokes.

#### E) Docs + tests
- Update subsystem docs that describe View menu or MapEditorCanvas rendering.
- Add/extend unit tests for:
  - menu template wiring + checked-state behavior for the new View menu items
  - AppStore defaults + setters for the new view flags

### Out of scope
- Any new editing commands or selection semantics.
- Changes to how portals are authored or validated.
- New render modes, shading, or texture pipeline changes.
- Hiding doors in **wireframe** mode.

## Constraints
- **L01 (Cross-platform parity):** View menu behavior and rendering must be consistent across macOS/Windows/Linux.
- **L03 (Electron security):** Renderer must remain snapshot-driven and must not gain privileged access.
- **L04 (Testing):** Any changed public method/signature must have tests covering conditional paths.
- **L08 (Design for testability):** Keep state changes in main store; renderer reads via snapshot.
- **L09 (Docs):** Update relevant docs under `docs/` (Menu System and Renderer UI System) to reflect new view toggles.
- **Style:** Keep the menu template factory pure; keep renderer changes view-layer only.

## Acceptance criteria

### Highlight portals
- When View → Highlight Portals is enabled:
  - Any wall with `back_sector > -1` renders in blue in both Wireframe and Textured modes.
  - Walls with `back_sector === -1` are unchanged.
- When disabled, rendering is unchanged from pre-Phase behavior.

### Highlight selected object
- When a map object is selected via Select tool:
  - A red outline is visible for the selection kind (wall/sector/door/entity/light/particle).
  - The outline remains visible at both low and high zoom (stroke is not “lost” due to scaling).
  - Changing selection updates the highlight immediately.
  - Clearing selection removes the highlight.

### Toggle door visibility
- View → Toggle Door Visibility is present and is **off by default** (doors visible).
- When door visibility is toggled to hidden:
  - In **Textured** mode, door markers are not drawn.
  - In **Wireframe** mode, door markers remain drawn.
- Toggling back to visible restores door markers in textured mode.

### State + wiring
- The new view toggles are owned by main `AppStore`, included in the `AppStateSnapshot`, and reflected in the checked state of View menu items.
- Existing `npm test`, `npm run typecheck`, and `npm run lint` pass.

## Risks / notes
- Selection outlines must be layered so they are visible without obscuring textures; the implementation should prefer a thin, non-scaling outline stroke.
- Portal highlighting in textured mode must not break the missing-texture fallback (wireframe segment fallback should still work).
