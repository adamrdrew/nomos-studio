# Phase 0007 — UI Refinements (Grid + Toolbox)

## Intent
Refine the editor UI so it behaves like a durable creative tool shell:
- Add **View menu** controls for the map editor **grid visibility** and **grid opacity** (bounded by min/max).
- Improve default **panel sizing** (Inspector narrower on first open).
- Redesign the left tool UI into a more “toolbox” style (icon buttons, sensible sizing, tooltips, no weird stretching).
- Prevent critical panels (Map Editor + Inspector) from being **closable**, avoiding “closed forever” failure states.

This Phase exists now because Phase 0005/0006 established the editor shell and map viewing; these refinements reduce UX friction and set up a stable layout for adding more tools later.

## Scope

### In scope
- **View menu: grid controls**
  - Add a View menu item to **toggle grid** visibility in the Map Editor.
  - Add View menu items to **increase** and **decrease** grid opacity.
  - Grid opacity changes must clamp to configured **min/max** bounds.
  - Menu actions must update the renderer promptly via the existing main→renderer state change signal.

- **Grid rendering respects state**
  - Map Editor grid rendering must:
    - not render when grid is disabled
    - render with the configured opacity when enabled

- **Default panel sizing**
  - On app open, the right Inspector panel should start at approximately **20%** of the window width (within reasonable tolerance), rather than taking an overly large share.

- **Toolbox redesign (left tool UI)**
  - Rename conceptually to **Toolbox** (terminology in docs and component naming if/when renames are performed).
  - Toolbox is a left overlay inside the Map Editor panel.
  - Make the toolbox a bit wider (not “crazy wide”) and change the buttons to:
    - icon-based (no single-letter labels)
    - fixed-height (no fill-stretching that makes each tool consume ~1/3 of the panel)
    - show a tooltip on hover (e.g., “Select”, “Pan”, “Zoom”)
  - Layout must allow adding more tools later without odd stretching (e.g., a scrollable column or compact grid).
  - Use an existing, high-quality icon set already in-repo if possible.
    - **Preferred:** Blueprint icons (`@blueprintjs/icons`) since it’s already a dependency.

- **Prevent closing Map Editor + Inspector**
  - The Map Editor and Inspector panels must not be closeable via the DockView UI.
  - Closing via the UI must be disabled (no close affordance, and/or close attempts are rejected).

### Out of scope
- Adding new tools beyond Select/Zoom/Pan.
- Persisting grid settings or panel sizes across restarts (unless it “falls out” of existing AppStore/state snapshot patterns without introducing new settings fields).
- Keyboard shortcuts for new menu items.
- Dock layout serialization/restore.
- Any map editing operations.

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** menu and UI behavior must work on macOS/Windows/Linux.
  - **L02 (Offline):** no network requirement.
  - **L03 (Electron security):** renderer state changes remain renderer-only or flow via typed IPC/state snapshot; no new privileged renderer access.
  - **L04 (Testing):** new/changed public methods (menu template options, AppStore setters, IPC snapshot types) must have unit tests covering conditional paths.
  - **L08 (Testability):** keep Electron primitives behind injectables; keep menu template factory pure.
  - **L09 (Docs current):** update relevant `docs/` files for behavior/API changes.
- Must follow `.ushabti/style.md`:
  - avoid new dependencies unless clearly justified
  - keep state/data shapes typed and explicit

## Acceptance criteria

### View menu grid controls
- Application menu includes View items:
  - **Toggle Grid** (toggles grid visibility)
  - **Increase Grid Opacity**
  - **Decrease Grid Opacity**
- Grid opacity adjustments respect bounds:
  - **Assumption (can be changed):** opacity is clamped to $[0.10, 0.80]$ in increments of $0.10$.
  - Repeated “increase” at max does not exceed max.
  - Repeated “decrease” at min does not go below min.

### Grid rendering behavior
- When grid is toggled off, the grid is not visible in the Map Editor.
- When grid is toggled on, the grid renders at the current opacity.

### Default Inspector width
- On initial app open, the Inspector panel width is approximately **20%** of the window width (target), and is materially narrower than today.

### Toolbox layout + usability
- Toolbox uses **icon buttons** (no “S/Z/P” labels) with **tooltips**.
- Toolbox buttons do not vertically stretch to fill the toolbox height; adding/removing tools does not cause each tool button to grow unusually.
- Toolbox is “a bit wider” than today while remaining compact.

### Map Editor + Inspector not closable
- The Map Editor and Inspector DockView panels cannot be closed via UI.
- The user cannot get into a state where those panels disappear and cannot be recovered without restarting.

### Quality gates
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.

## Risks / notes
- DockView has multiple ways to control close behavior (tab options vs intercepting close events). Implementation should prefer the most direct supported API.
- If grid settings are stored in main `AppStore` (to keep menus + renderer consistent), the IPC snapshot types must be updated and tests added.
- Icon selection should prefer Blueprint’s built-in icons to avoid dependency churn.
