# Phase 0040 — Snap to Grid

## Intent
Add a **Snap to Grid** mode (enabled by default) that can be toggled from the **View** menu. When enabled, map editing interactions that place geometry/objects use **grid-aligned world coordinates**, improving precision and consistency.

This Phase records a single, bounded work order: introduce the toggle + state plumbing and apply snapping to the specified interaction flows.

## Scope

### In scope
- Add a new View menu checkbox command: **Snap to Grid**.
  - Enabled by default.
  - Located near existing grid-related View commands (adjacent to “Toggle Grid” / opacity items).
  - Checked state reflects main-owned state.
- Introduce main-owned state for snap-to-grid and surface it to the renderer via the existing snapshot flow.
  - Prefer extending the existing `MapGridSettings` shared type so grid-related view state stays grouped.
- Ensure the editor grid is defined in **world units** at all times.
  - The grid’s world spacing may change with zoom (to remain readable), but any chosen spacing MUST be a congruent world-unit step (e.g., 1, 2, 4, 8, … world units).
  - Rendering may still skip drawing minor lines when they become too dense in screen pixels.
- Apply snapping (when enabled) to these operations:
  - Room creation (template rooms + Room Clone stamp placement) — snapped pointer world point drives preview + commit.
  - Wall splitting — snapped pointer world point is used when issuing `map-edit/split-wall`.
  - Entity placement — drag/drop uses snapped world point for validity + `map-edit/create-entity`.
  - Light placement — click uses snapped world point for validity + `map-edit/create-light`.
  - Moving entities/lights (Move tool) — snapped end position is used when committing move edits.
  - Player start placement (pick mode) — snapped world point is used when committing `map-edit/set-player-start`.
  - Wall slicing (wall slice tool) — any pointer-derived cut points are snapped before issuing edits.
- Unit tests covering new public APIs and all conditional paths per laws.
- Update subsystem docs impacted by the new behavior and menu item.

### Out of scope
- Adding a user-configurable grid size / snapping increment UI.
- Snapping for other edit flows not listed above (e.g., player-start pick, door placement, wall slice tool) unless they already share the same placement pipeline being modified.
- Persisting snap-to-grid preference across app restarts (unless existing grid view state is already persisted; at present it appears snapshot-only).

## Constraints
- Must comply with:
  - L03 (Electron security boundary): renderer continues to act via preload/IPC and uses snapshot state only.
  - L04 (Testing policy): any new/changed public methods must have unit tests covering conditional paths.
  - L08 (Testability): snapping logic should be factored so it is easy to test deterministically.
  - L09 (Docs): update relevant docs under `docs/`.
- Follow the layering guidance in `.ushabti/style.md`:
  - Snap policy used by renderer interactions belongs in renderer/UI logic (no new renderer→main privileged access).

## Acceptance criteria
- View menu contains a checkbox item labeled **Snap to Grid** near other grid-related items.
  - Default state is ON (checked) on fresh app launch.
  - Toggling it updates main store state and the renderer snapshot reflects the change.
- When Snap to Grid is ON:
  - Room creation preview and committed rooms use grid-snapped pointer world coordinates as the placement anchor.
  - Room Clone stamp placement preview and commit use grid-snapped pointer world coordinates as the placement anchor.
  - Split Wall uses grid-snapped pointer world coordinates for the `at` input (projection behavior remains deterministic).
  - Entity drop placement and Light placement commit coordinates that are snapped to the grid.
  - Move tool commits snapped `{x,y}` positions for entities and lights.
  - Player start pick commits snapped `{x,y}`.
  - Wall slice tool uses snapped cut points.
- When Snap to Grid is OFF:
  - The above operations behave exactly as they do today (no coordinate rounding).

- **Modifier override:** When Snap to Grid is ON, holding **Shift** temporarily disables snapping for pointer-driven placement operations so designers can bypass snapping (e.g., to reach room-merge “magnetism” positions) without changing the merge/magnetism code path.

- **Displayed grid congruence:** the grid spacing selected for display is always a world-unit step (no drifting “virtual” grid), and snapping uses the exact same spacing currently displayed.
- Tests:
  - Menu template tests assert the new menu item exists and checked reflects state.
  - AppStore tests assert default snap setting is ON and toggling flips it.
  - Renderer store or UI unit tests cover that snapshot values flow through and snapping is applied/omitted on both branches.
- Docs are updated to mention the new View menu command and snap behavior.

## Risks / notes
- **Grid increment definition:** the grid spacing used for snapping must match the grid spacing displayed by the editor at the current zoom.
  - To keep the grid congruent with world units, spacing should be selected from a small discrete set of world-unit steps (e.g., powers of two).
- Snapping can change validity outcomes near sector boundaries (snapped point might fall outside). This Phase will define validity using the snapped point to avoid preview/commit mismatch.

## Assumptions
- The snap increment is the **currently displayed minor grid world spacing**.
- The displayed minor grid spacing is chosen from a discrete set of **integer** world-unit steps based on zoom:
  - Candidates: `1, 2, 4, 8, 16, 32, 64, 128, 256`.
  - Selection target: approximately **24px** between minor lines in screen space (as zoom changes).
  - Major grid lines occur every **5** minor cells.
