# Phase 0017 Steps — Map Editor View Overlays (Portals, Selection, Doors)

## S001 — Confirm existing render + selection plumbing and define target visuals
- **Intent:** Anchor the change to current codepaths and avoid unintended render regressions.
- **Work:**
  - Identify where View menu state is derived (main `AppStore` → snapshot → `useNomosStore`).
  - Identify where walls/doors/markers render in both modes (`MapEditorCanvas`).
  - Decide the concrete visual rules:
    - portal blue color (pick a Blueprint color constant)
    - selection outline thickness (screen-space constant)
    - layering order so outlines are visible.
- **Done when:** A short note in the Phase implementation PR describes chosen colors/thickness + layer order.

## S002 — Extend shared models for new view flags
- **Intent:** Make the new view toggles first-class typed state.
- **Work:**
  - Extend `src/shared/domain/models.ts` with:
    - `mapHighlightPortals: boolean`
    - `mapDoorVisibility: 'visible' | 'hidden'` (or `mapDoorsVisible: boolean` if preferred by existing conventions)
  - Extend `AppStateSnapshot` in `src/shared/ipc/nomosIpc.ts` to include these fields.
- **Done when:** Shared model types and `AppStateSnapshot` include the new fields (wiring/compile fixes happen in S003–S005).

## S003 — Add defaults + setters in main `AppStore`
- **Intent:** Keep source-of-truth in main and ensure deterministic defaults.
- **Work:**
  - Update `src/main/application/store/AppStore.ts`:
    - initialize defaults (highlight portals off; doors visible)
    - add setters/togglers (public methods) for the new fields.
  - Add/update `src/main/application/store/AppStore.test.ts` to cover:
    - default values
    - setter behavior and subscriber notification.
- **Done when:** Tests cover all conditional paths for the new public setters.

## S004 — Thread new view flags through snapshot and renderer store
- **Intent:** Keep renderer snapshot-driven (L03) and consistent with menu checked states.
- **Work:**
  - Update the main snapshot construction to include the new fields.
  - Update `src/renderer/store/nomosStore.ts` to store and refresh them.
- **Done when:** Renderer store state updates on `refreshFromMain()` and on `state:changed` refresh.

## S005 — Add View menu items and wire callbacks
- **Intent:** Provide user-facing toggles with correct checked-state behavior.
- **Work:**
  - Extend `CreateApplicationMenuTemplateOptions` and `createApplicationMenuTemplate` to include:
    - Highlight Portals (checkbox)
    - Toggle Door Visibility (checkbox)
  - Wire callbacks in `src/main/main.ts` to update `AppStore`.
  - Update `src/main/infrastructure/menu/createApplicationMenuTemplate.test.ts` to cover:
    - presence of items
    - checked-state reflects options
    - click handlers call callbacks.
- **Done when:** Menu tests pass and items appear under View.

## S006 — Implement portal highlighting in wireframe rendering
- **Intent:** Make portals readable in geometry-first mode.
- **Work:**
  - In `MapEditorCanvas` wireframe wall loop, render walls with `backSector > -1` in blue.
  - Keep stroke width + hit-testing unchanged.
- **Done when:** Portals appear blue in wireframe, non-portals unchanged.

## S007 — Implement portal highlighting in textured rendering
- **Intent:** Make portals readable while authoring texture details.
- **Work:**
  - In textured wall rendering, apply a blue stroke/overlay treatment for portal walls.
  - Ensure missing-texture fallback (wireframe segment) still uses portal blue.
- **Done when:** Portals are blue in textured mode for both textured polygons and fallback segments.

## S008 — Implement selected-object red outline overlay
- **Intent:** Improve focus and reduce selection ambiguity.
- **Work:**
  - Add a dedicated overlay rendering pass in `MapEditorCanvas` that draws a red outline for the current `mapSelection`.
  - Implement per-kind outlines:
    - `wall`: outline the wireframe segment (wireframe mode) and the textured strip polygon (textured mode).
    - `sector`: outline the sector boundary loop.
    - `door`: outline the door marker.
    - markers: outline the marker shape.
  - Ensure stroke is readable across zoom (non-scaling or compensated like other strokes).
- **Done when:** Every selection kind above shows a red outline that updates/clears correctly.

## S009 — Implement “Toggle door visibility” behavior (textured only)
- **Intent:** Allow decluttering textured view without losing door editability.
- **Work:**
  - Add a conditional so door markers are skipped in textured mode when doors are hidden.
  - Keep door hit-testing behavior unchanged unless explicitly decided otherwise in S001.
- **Done when:** In textured mode, door markers hide/show; in wireframe, always show.

## S010 — Update docs (L09)
- **Intent:** Keep subsystem docs accurate.
- **Work:**
  - Update `docs/menu-system.md` to list new View items and the new options fields.
  - Update `docs/renderer-ui-system.md` to document:
    - portal highlighting
    - selection outline overlay
    - textured-only door visibility toggle.
- **Done when:** Docs reflect new toggles and behaviors.

## S011 — Quality gates
- **Intent:** Ensure the Phase is shippable.
- **Work:**
  - Run: `npm test`, `npm run typecheck`, `npm run lint`.
  - Perform a quick manual pass:
    - toggle Highlight Portals in both render modes
    - select each object kind and verify red outline
    - toggle Door Visibility in textured mode.
- **Done when:** All commands pass and manual checks are recorded.
