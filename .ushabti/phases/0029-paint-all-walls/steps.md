# Steps — Phase 0029 (Paint All Walls)

## S001 — Confirm “surrounding wall” definition (front_sector)
- **Intent:** Ensure the feature updates the walls the user expects without unintentionally touching neighboring sectors.
- **Work:**
  - Confirm in existing docs/code that a sector’s visible boundary walls (for editing) are those with `front_sector === sectorId`.
  - Spot-check portal adjacency behavior to ensure this rule does not cause paint to “bleed” into neighboring sectors.
  - Record the rule explicitly in the command doc.
- **Done when:** The rule “paint walls where `front_sector === sectorId` only” is documented and treated as the non-negotiable boundary.

## S002 — Define a new atomic map-edit command in the shared IPC contract
- **Intent:** Provide a single, typed, undoable operation without relying on large transactions.
- **Work:**
  - Extend `MapEditAtomicCommand` in `src/shared/ipc/nomosIpc.ts` with a new command (name chosen to match existing idioms), e.g.:
    - `kind: 'map-edit/set-sector-wall-tex'` (or `map-edit/paint-all-walls`)
    - `sectorId: number`
    - `tex: string`
  - Ensure the command uses the existing texture filename convention (no full paths).
- **Done when:** Typecheck passes with the new command shape wired into the union.

## S003 — Implement the command in MapCommandEngine
- **Intent:** Apply the texture change deterministically in the main process while preserving atomicity.
- **Work:**
  - Add a new `case` in `MapCommandEngine.applyAtomic`.
  - Validate inputs:
    - `sectorId` is a finite integer.
    - `tex` is a non-empty string (trimmed).
  - Validate JSON shape:
    - `walls` exists and is an array.
    - each matching wall entry is an object and can accept `tex` updates.
  - Update `tex` for all walls in `walls[]` that match the “surrounding wall” rule.
  - Return `selection: map-edit/selection/keep`.
- **Done when:** The command updates wall textures correctly in-memory and returns a success result with keep-selection.

## S004 — Add MapCommandEngine unit tests for all conditional paths
- **Intent:** Satisfy L04 and prevent regressions.
- **Work:** Add tests covering:
  - Success: sector has N boundary walls → all their `tex` values update.
  - Non-target walls remain unchanged (different `front_sector`).
  - Portal walls are updated when they match via `front_sector`.
  - No-op success: sector exists but has zero matching walls.
  - Failure cases:
    - `walls` missing or not an array ⇒ `map-edit/invalid-json`.
    - invalid `sectorId` or empty `tex` ⇒ `map-edit/invalid-json`.
- **Done when:** Tests cover each branch and are green.

## S005 — Ensure MapEditService integrates the new command end-to-end
- **Intent:** Verify the command is reachable from renderer edits and participates in history/dirty tracking.
- **Work:**
  - Update any command-type narrowing in `MapEditService` (if present) so the new command is accepted.
  - Add/extend a `MapEditService` unit test only if needed to cover integration behavior (single history step, selection keep).
- **Done when:** The new command can be executed through `window.nomos.map.edit(...)` without type or runtime routing issues.

## S006 — Add the “Texture Walls” control to the Sector Object Properties UI
- **Intent:** Expose the feature in the user workflow with predictable commit semantics.
- **Work:**
  - Update the sector branch of the Inspector Object Properties UI (currently in `src/renderer/ui/editor/inspector/PropertiesEditor.tsx`).
  - Add a dropdown (options from `getTextureFileNames(assetIndex)`), plus a **Set** button adjacent.
  - Keep selection changes local until **Set** is clicked.
  - Establish initial dropdown display state:
    - if all sector boundary walls share the same `tex`, preselect it
    - otherwise show a “(mixed)” placeholder until the user picks a texture
  - Disable the **Set** button when there is no valid selection or no textures indexed.
- **Done when:** The UI renders only for sector selections and triggers exactly one map edit when Set is clicked.

## S007 — Update subsystem documentation (L09)
- **Intent:** Keep docs aligned with behavior and API surface.
- **Work:**
  - Update `docs/map-edit-command-system.md`:
    - add the new atomic command shape and validation/selection semantics
    - document the “surrounding wall” matching rule
  - Update `docs/renderer-ui-system.md`:
    - note the new sector Object Properties control and its commit semantics (dropdown vs Set).
- **Done when:** Docs are consistent with the implemented behavior and match the command name/fields.

## S008 — Manual smoke test in the editor
- **Intent:** Validate the full UI → edit → render loop.
- **Work:**
  - Open a map with at least one sector.
  - Select a sector; choose a texture; click **Set**.
  - Verify textured mode shows the new wall texture around the sector.
  - Undo/redo the action and confirm wall textures revert/reapply.
- **Done when:** The workflow behaves as described with no crashes or stale selection issues.

## S009 — Verification gates
- **Intent:** Ensure repository stays green.
- **Work:**
  - Run `npm test -- --runInBand`.
  - Run `npm run typecheck`.
  - Run `npm run lint`.
- **Done when:** All tasks succeed.
