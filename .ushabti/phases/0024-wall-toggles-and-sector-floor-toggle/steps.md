# Phase 0024 — Steps

## S001 — Inspect current Object Properties editors for walls/sectors
- **Intent:** Ground the work in the existing inspector/property editor patterns and current editable field set.
- **Work:**
  - Locate the Object Properties UI components for walls and sectors.
  - Identify how edits are committed (expected: `window.nomos.map.edit` using `map-edit/update-fields`).
  - Confirm how sector IDs are represented in the decoded view model (numeric `id` vs array index).
- **Done when:** Notes capture the relevant components/modules and the exact data sources for sector IDs and wall fields.

## S002 — Confirm canonical field names and asset prefixes
- **Intent:** Prevent shipping UI that writes fields the validator/runtime won’t use.
- **Work:**
  - Check existing map examples (e.g., under `docs/repro-maps/` or assets maps) for:
    - wall toggle fields (`toggle_sector*`, `toggle_sound*`)
    - sector toggled floor field name (`floor_z_toggled_pos`)
  - Confirm the effects sounds folder prefix in `AssetIndex.entries` matches `Sounds/Effects/`.
  - Confirm stored value shape for sound fields (basename vs relative path) by inspecting existing authored maps.
- **Done when:** A short decision note is recorded (and Phase assumptions are updated if needed).

## S003 — Add wall toggle controls (conditional UI)
- **Intent:** Enable authors to edit wall toggle properties with correct default visibility.
- **Work:**
  - Add `toggle_sector` checkbox for walls (always visible).
  - When checked, render additional controls:
    - `toggle_sector_id` sector-ID dropdown
    - `toggle_sector_oneshot` checkbox
    - `toggle_sound` dropdown
    - `toggle_sound_finish` dropdown
  - Ensure values are read from the selected wall and writes commit via map-edit update-fields.
  - Ensure undo/redo works through the existing system.
- **Done when:** Manual verification in-app shows fields appear/disappear correctly and commit edits.

## S004 — Implement the `toggle_sector_id` eye-dropper (pick sector mode)
- **Intent:** Make selecting a target sector fast and reliable.
- **Work:**
  - Add a small eye-dropper button next to the dropdown.
  - When active:
    - the next sector selection updates `toggle_sector_id` and exits pick mode
    - provide a clear active indicator
    - allow cancelling (e.g., Escape, or clicking the button again)
  - Ensure this is renderer-local UI state and does not widen preload/IPC.
- **Done when:** A sector click reliably sets the ID and exits the mode without breaking normal selection behavior.

## S005 — Populate sound dropdowns from `Sounds/Effects/`
- **Intent:** Ensure sound fields only select valid assets.
- **Work:**
  - Derive options from `assetIndex.entries` filtered by the confirmed `Sounds/Effects/` prefix.
  - Decide and enforce stored value shape (basename vs relative path) per S002.
  - Ensure missing/unconfigured asset index yields a clear disabled/empty-state.
- **Done when:** Dropdowns populate correctly when assets are configured; commit updates wall JSON fields.

## S006 — Add sector `floor_z_toggled_pos` dropdown (-10..10)
- **Intent:** Expose the sector toggle position consistently for all sectors.
- **Work:**
  - Add a sector property control for `floor_z_toggled_pos` as an integer dropdown -10..10.
  - Ensure commits are numeric and undoable.
- **Done when:** Selecting a sector shows the control and changing it updates the map JSON via edit commands.

## S007 — Add main-owned view flag + View menu item (Highlight Toggle Walls)
- **Intent:** Match existing overlay toggles (Highlight Portals) and keep view flags snapshot-driven.
- **Work:**
  - Add a new boolean flag (e.g., `mapHighlightToggleWalls`) in main AppStore default state and snapshot.
  - Extend the menu template to include View → Highlight Toggle Walls (checkbox).
  - Wire toggle to update the store.
- **Done when:** The menu item exists, checked state reflects store, and toggling updates snapshot state.

## S008 — Render toggle-wall overlay in Map Editor canvas
- **Intent:** Provide visual discoverability for interactive walls.
- **Work:**
  - When the new view flag is enabled, shade/overlay walls with `toggle_sector === true` in green.
  - Match the style and layering approach used for portal highlighting; do not alter hit-testing.
- **Done when:** In-app, toggle walls are green-highlighted only when the view option is enabled.

## S009 — Unit tests for menu template + store flag (L04)
- **Intent:** Lock in behavior and cover conditional paths for new public surface.
- **Work:**
  - Add/extend unit tests that verify:
    - the new View menu item exists and is a checkbox
    - checked state follows `mapHighlightToggleWalls`
    - callback wiring triggers the expected store update callback
  - Add/extend AppStore tests for default value and toggle behavior.
- **Done when:** Tests fail before implementation and pass after, covering the new branches.

## S010 — Docs update (L09)
- **Intent:** Keep subsystem docs truthful.
- **Work:**
  - Update `docs/renderer-ui-system.md`:
    - new wall toggle property editor fields
    - new Highlight Toggle Walls overlay
  - Update `docs/menu-system.md` to include the new View menu item.
- **Done when:** Docs accurately describe the new controls and overlay.

## S011 — Quality gates + manual verification record
- **Intent:** Ship the Phase green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual verify:
    - conditional wall toggle fields
    - sector dropdown range
    - eye-dropper selection + cancel behavior
    - green highlight toggle walls overlay
- **Done when:** All gates pass and verification notes are recorded in `review.md`.
