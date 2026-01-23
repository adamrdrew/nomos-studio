# Phase 0029 — Paint All Walls

## Intent
Add a sector-level convenience action in the Inspector’s Object Properties that lets the user choose a wall texture and apply it to every wall surrounding the selected sector.

This Phase exists now because wall textures are currently edited wall-by-wall, which is slow for authoring and makes it hard to quickly restyle a sector.

## Scope

### In scope
- **Renderer UI (Object Properties, sector selection):**
  - When a **sector** is selected, show a new control group:
    - Label: **Texture Walls**
    - A dropdown populated from asset index entries under `Images/Textures/` (fallback `Assets/Images/Textures/`) using the existing filename (basename) convention.
    - A **Set** button next to the dropdown.
  - Selecting an option in the dropdown **does not** commit changes.
  - Clicking **Set** applies the chosen texture to all walls surrounding the selected sector.
  - The control must handle empty/no-texture index states gracefully (e.g., show a “No textures indexed” option/message and disable Set).
  - If the sector’s walls currently have mixed textures, the dropdown may show a “(mixed)” state until the user chooses a new texture.

- **Main-process map edit support:**
  - Add a new atomic map edit command to apply a wall texture across a sector boundary set in one operation (single undo step).
  - The operation updates `walls[].tex` for every wall that belongs to the selected sector’s boundary.
  - Selection effect remains `map-edit/selection/keep` (sector stays selected).

- **Tests:**
  - Add/extend unit tests for the new command in `MapCommandEngine` covering all conditional paths.

- **Documentation (L09):**
  - Update `docs/map-edit-command-system.md` to document the new atomic command.
  - Update `docs/renderer-ui-system.md` to mention the new sector Object Properties control.

### Out of scope
- Painting walls for multiple selected sectors (no multi-select UI in this Phase).
- Any new renderer component test harness (this repo currently relies on main-process unit tests + manual UI verification).
- Changes to how textures are resolved/loaded for rendering (still filename-based with `Images/Textures/` prefixing at load time).
- Adding new wall texture fields (e.g., upper/lower textures) or per-wall texture alignment controls.

## Constraints
- **L01 Desktop Cross-Platform Parity:** No OS-specific behavior; implementation must be deterministic and portable.
- **L03 Electron Security:** Renderer must only request edits via existing preload/IPC (`window.nomos.map.edit`). No new privileged surface beyond the new typed command.
- **L04 Testing Policy:** New/changed public behaviors (notably the new command path) must be covered by unit tests for all branches.
- **L08 Design for Testability:** Keep logic pure and unit-testable; no direct filesystem, time, or Electron dependencies in command application.
- **L09 Documentation:** Update subsystem docs in the same change.

## Acceptance criteria
- With a sector selected, Object Properties shows **Texture Walls** with a dropdown + **Set** button.
- The dropdown options come from assets under `Images/Textures/` (fallback `Assets/Images/Textures/`) and display basenames.
- Clicking **Set** applies the chosen texture filename to every “surrounding wall” of the selected sector.
- The operation is applied as a single edit (one undo step) and leaves selection on the same sector.
- No-texture states are handled gracefully (no crash; Set is disabled or no-ops with clear UI state).
- Jest, typecheck, and lint are green.
- `docs/map-edit-command-system.md` and `docs/renderer-ui-system.md` reflect the new behavior.

## Assumptions
- **Wall ownership for a sector boundary (no cross-boundary painting):** “Walls surrounding a sector” are defined as the set of `walls[]` entries where `front_sector === <sectorId>`.
  - This matches the editor’s “room (sector)” mental model: painting applies to the selected room’s visible boundary walls.
  - This Phase does **not** paint walls where the sector is only referenced via `back_sector`.
  - This Phase does not attempt to paint walls for adjacent rooms across portal boundaries.

- **Command naming:** The shared IPC command name should follow existing idioms (e.g., `map-edit/set-player-start`). Either `map-edit/set-sector-wall-tex` or `map-edit/paint-all-walls` is acceptable; pick the more consistent option during implementation.

## Risks / notes
- If the map format in practice relies on a sector’s visible boundary being represented only via `back_sector` (with no corresponding `front_sector` wall entries), this Phase’s definition of “surrounding walls” would miss some walls. If discovered, this Phase should be amended before implementation rather than silently changing semantics.
- Transaction limits: implementing this as a transaction of per-wall `update-fields` commands could hit `MAX_TRANSACTION_COMMANDS` for large sectors. This Phase therefore prefers a dedicated atomic command.
