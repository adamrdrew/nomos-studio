# Steps — Phase 0040 (Snap to Grid)

## S001 — Confirm displayed-grid snap increment rules
- **Intent:** Make snapping match the grid the user sees, while staying congruent with world units.
- **Work:** Confirm:
  - the discrete candidate set for minor grid world spacing (e.g., 1, 2, 4, 8, … world units)
  - the target screen-space density behavior (e.g., aim ~24px between minor lines)
  - major-line cadence (e.g., every 5 minor cells)
- **Done when:** These rules are recorded in `phase.md` assumptions.

## S002 — Extend shared grid settings type
- **Intent:** Make snap-to-grid state part of the existing grid-related snapshot shape.
- **Work:** Extend `MapGridSettings` (shared type) with a boolean flag (e.g., `isSnapToGridEnabled`).
- **Done when:** Type changes compile and all consumers are updated to the new shape.

## S003 — Add main-store state + mutators
- **Intent:** Make snap-to-grid main-owned, toggleable, and default-on.
- **Work:**
  - Update `AppStore` default grid settings to set snap enabled by default.
  - Add a public mutator in `AppStore` to set/toggle snap-to-grid.
- **Done when:** `AppStore` exposes a public API to toggle and the default state is ON.

## S004 — Add menu wiring: View → Snap to Grid
- **Intent:** Provide the user-facing toggle.
- **Work:**
  - Update `createApplicationMenuTemplate` to include a View checkbox item labeled “Snap to Grid” near the existing grid menu items.
  - Thread the new callback option through `setApplicationMenu` in `src/main/main.ts` and wire it to the store mutator.
- **Done when:** The menu item appears, reflects checked state, and toggles store state.

## S005 — Surface snap state in the renderer snapshot
- **Intent:** Renderer interaction logic can read snap state without new IPC.
- **Work:** Ensure the existing snapshot (`AppStateSnapshot.mapGridSettings`) includes the new snap boolean, and the renderer store caches it.
- **Done when:** Renderer `useNomosStore` state includes the snap boolean via `mapGridSettings`.

## S006 — Align grid display spacing + snap spacing (renderer)
- **Intent:** Guarantee snap-to-grid uses the exact grid spacing currently displayed.
- **Work:** Factor the “choose minor grid world spacing” logic into a reusable, testable helper and use it both for:
  - grid rendering (minor/major lines)
  - snapping world points when snap mode is enabled
- **Done when:** Grid lines and snapped coordinates always land on the same lattice for a given zoom.

## S007 — Implement reusable snapping helper (renderer)
- **Intent:** Centralize snap math and keep it testable.
- **Work:** Add a small pure helper that snaps a world point `{x,y}` to the fixed grid increment.
- **Done when:** Helper is used by all in-scope operations and has unit tests for rounding/edge cases.

## S008 — Apply snapping to room creation + room clone placement
- **Intent:** Room placement is the highest-impact precision workflow.
- **Work:** In the room tool interaction pipeline, snap the pointer world point when snap mode is enabled.
  - Ensure both preview polygon and the created/stamped room command use the snapped anchor.
  - Ensure validity checks use the snapped geometry to avoid preview/commit mismatch.
- **Done when:** Room previews/commits align to grid when enabled and are unchanged when disabled.

## S009 — Apply snapping to wall splitting
- **Intent:** Make split behavior consistent with snap mode while preserving existing deterministic projection semantics.
- **Work:** When issuing `map-edit/split-wall`, snap the `at` world point when snap mode is enabled.
- **Done when:** Split operations choose split locations based on snapped pointer input when enabled; unchanged when disabled.

## S010 — Apply snapping to entity + light placement
- **Intent:** Ensure object placement aligns to grid.
- **Work:**
  - Entity drag/drop: use snapped world point for “inside sector” validity and `map-edit/create-entity` `at`.
  - Light placement: use snapped world point for validity and `map-edit/create-light` `at`.
- **Done when:** Entities/lights are created at grid-aligned coordinates when enabled; unchanged when disabled.

## S011 — Apply snapping to move tool + player start + wall slice
- **Intent:** Cover all placement-affecting operations in the game world.
- **Work:**
  - Move tool: snap the committed final `{x,y}` for entities/lights when enabled.
  - Player-start pick: snap the committed `{x,y}` when enabled.
  - Wall slice tool: snap any pointer-derived cut points when enabled.
- **Done when:** Each operation’s committed coordinates are snapped when enabled and unchanged when disabled.

## S012 — Tests (menu/store/renderer)
- **Intent:** Meet L04 branch-coverage expectations for changed public APIs.
- **Work:**
  - Update menu template tests to assert the Snap to Grid item exists, is near grid items, and `checked` reflects state.
  - Update `AppStore` tests for default snap = ON and toggle behavior.
  - Add/extend renderer tests for snap helper and for one representative placement flow toggling ON/OFF.
- **Done when:** Jest suite passes and tests cover both snap-enabled and snap-disabled branches.

## S013 — Documentation updates
- **Intent:** Keep subsystem docs truthful (L09).
- **Work:** Update:
  - `docs/menu-system.md` View menu list to include Snap to Grid.
  - `docs/renderer-ui-system.md` to describe snap mode behavior for the in-scope operations.
- **Done when:** Docs accurately describe the new menu command and snapping behavior.
