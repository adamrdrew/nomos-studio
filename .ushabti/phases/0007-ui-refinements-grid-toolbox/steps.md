# Phase 0007 Steps — UI Refinements (Grid + Toolbox)

## S001 — Confirm UI constants and icon mapping
- **Intent:** Remove ambiguity so implementation + tests have stable targets.
- **Work:**
  - Confirm/record:
    - grid opacity **min/max** and **step size**
    - whether opacity changes are allowed while grid is hidden (recommended: allowed; opacity still updates)
    - desired toolbox layout shape (recommended: single compact column; scroll if needed)
  - Choose icon mapping for tools using Blueprint icons:
    - Select (cursor/pointer)
    - Pan (hand)
    - Zoom (magnifier)
- **Done when:** The chosen constants and icon mapping are recorded in this Phase (and used consistently in subsequent steps).

## S002 — Add grid settings to the main renderer snapshot (state shape)
- **Intent:** Let menu actions drive renderer behavior using the existing main→renderer state change signal.
- **Work:**
  - Add a typed `MapGridSettings` (or similar) state shape to the main `AppStore` and to the renderer snapshot:
    - `isGridVisible: boolean`
    - `gridOpacity: number`
  - Define clamp behavior in one place (prefer: AppStore action/setter clamps).
- **Done when:** The renderer snapshot includes grid settings and is fully typed end-to-end.

## S003 — Extend View menu template with grid controls
- **Intent:** Provide user entrypoints to control the grid.
- **Work:**
  - Update the menu template factory to add View submenu items:
    - Toggle Grid (checked or checkbox-style)
    - Increase Grid Opacity
    - Decrease Grid Opacity
  - Thread required state into `CreateApplicationMenuTemplateOptions` (e.g., `mapGridSettings`) so the template remains pure.
- **Done when:** View menu items are present in the template and reflect current state (checked/unchecked where applicable).

## S004 — Wire menu callbacks in main to update store and notify renderer
- **Intent:** Make menu actions immediately affect the Map Editor.
- **Work:**
  - In main, implement callbacks for:
    - toggling grid visibility
    - increasing/decreasing opacity (with clamp)
  - Ensure these changes trigger the existing state-changed notification so renderer refreshes.
- **Done when:** Using the View menu updates main store state and the renderer reacts without restart.

## S005 — Make Map Editor grid respect visibility + opacity settings
- **Intent:** Connect state to rendering.
- **Work:**
  - Update `MapEditorCanvas` grid rendering:
    - if `isGridVisible === false`, do not draw the grid
    - otherwise draw grid with `gridOpacity`
  - Ensure existing adaptive grid spacing logic continues to work.
- **Done when:** Menu actions visibly show/hide the grid and adjust opacity.

## S006 — Set initial Inspector width to ~20% on app open
- **Intent:** Improve default layout ergonomics.
- **Work:**
  - Adjust DockView panel initialization so the Inspector starts around 20% width.
  - Preserve user resizing behavior during the session.
- **Done when:** Fresh app open shows a narrower Inspector by default.

## S007 — Prevent closing Map Editor and Inspector panels
- **Intent:** Eliminate the “closed forever” failure mode.
- **Work:**
  - Configure DockView so Map Editor and Inspector tabs are not closeable.
  - If DockView supports close events, also reject close attempts for these panels defensively.
- **Done when:** Close affordances are absent/disabled and panels cannot be closed.

## S008 — Redesign the left tool UI into a toolbox (icons + tooltips + non-stretch layout)
- **Intent:** Establish a scalable toolbox layout for future tools.
- **Work:**
  - Replace letter labels with Blueprint icons.
  - Add tooltips on hover (Blueprint tooltip component preferred over bare `title`, if consistent).
  - Change layout so buttons have fixed height and do not fill/stretch vertically.
  - Make toolbox slightly wider than current while remaining compact.
  - Ensure layout supports adding more tools without odd stretching (scrollable column or compact grid).
- **Done when:** Toolbox looks/behaves like a compact tool strip and remains stable as tool count changes.

## S009 — Update subsystem docs (L09)
- **Intent:** Keep docs as the source of truth.
- **Work:**
  - Update:
    - `docs/menu-system.md` (new View menu items)
    - `docs/renderer-ui-system.md` (grid settings, toolbox behavior, non-closable panels)
    - `docs/app-store-system.md` (new grid state in snapshot, if stored in AppStore)
- **Done when:** Docs accurately describe the behavior and state/API surfaces.

## S010 — Unit tests for new/changed public APIs (L04)
- **Intent:** Maintain safety and branch coverage.
- **Work:**
  - Add/update unit tests for:
    - menu template factory options and View menu item presence/checked state
    - AppStore grid state updates and clamp behavior (min/max)
    - IPC snapshot typing changes where applicable
- **Done when:** Tests cover conditional paths for all new/changed public methods.

## S011 — Quality gates
- **Intent:** Ensure repository remains green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All gates pass.
