# Steps — Phase 0037: Texture Select Control

## S001 — Inventory existing texture selects
- **Intent:** Ensure all texture-selection touchpoints are covered.
- **Work:** Locate and list every UI location that selects a texture basename (door/wall/sector floor/sector ceil/sector “Texture Walls”/settings defaults), including any special sentinel options.
- **Done when:** A checklist exists in this Phase notes (or as links in the PR description) mapping each location → file/component → current semantics to preserve.

## S002 — Centralize texture option extraction (pure helper)
- **Intent:** Avoid duplication and ensure consistent “Images/Textures/” vs “Assets/Images/Textures/” fallback behavior.
- **Work:** Introduce a shared, renderer-safe pure helper to extract sorted texture basenames from an `AssetIndex` (or from `AssetIndex.entries`).
- **Done when:** Both the Settings panel and Properties editor use the helper, and existing behavior matches current outputs.

## S003 — Add unit tests for the new helper (L04)
- **Intent:** Lock in the prefix fallback + sorting behavior.
- **Work:** Add Jest unit tests (node environment) covering:
  - prefers `Images/Textures/` when present
  - falls back to `Assets/Images/Textures/` when primary has no matches
  - filters blank/whitespace basenames
  - sorts lexicographically
- **Done when:** Tests pass and cover all conditional branches in the helper.

## S004 — Implement texture thumbnail loader utility
- **Intent:** Provide reusable, safe thumbnail loading for the picker.
- **Work:** Create a small renderer utility/hook that:
  - given a texture basename, resolves the relative path to attempt (matching existing conventions)
  - loads bytes via `window.nomos.assets.readFileBytes`
  - creates a `blob:` object URL and exposes it for rendering
  - revokes object URLs on cleanup
  - keeps any cache bounded (LRU)
- **Done when:** A single well-scoped module exists and documents its lifecycle expectations (mount/unmount/eviction).

## S005 — Build the Texture Select control (grid dropdown)
- **Intent:** Deliver the new visual UX as a reusable component.
- **Work:** Implement a component that:
  - renders current selection (name + optional preview)
  - opens a popover/dropdown with a scrollable grid of tiles
  - supports optional “none/unset”
  - visually indicates selected tile
  - calls `onChange(nextValue)` and closes on selection
  - degrades gracefully for missing previews
- **Done when:** Component can be dropped into multiple contexts with configurable labels/placeholder/special options.

## S006 — Integrate into Inspector: Door texture
- **Intent:** Replace the current door texture `<select>` with the new picker.
- **Work:** Swap the control while preserving:
  - “(select texture)” placeholder
  - unset behavior mapping to `MAP_EDIT_UNSET`
  - “No textures indexed” empty-state messaging
- **Done when:** Door texture editing works identically, but with visual picker.

## S007 — Integrate into Inspector: Wall texture
- **Intent:** Replace wall texture dropdown with the visual picker.
- **Work:** Swap control and preserve immediate commit behavior on change.
- **Done when:** Selecting a wall texture commits the same `map-edit/update-fields` payload as before.

## S008 — Integrate into Inspector: Sector floor/ceil textures
- **Intent:** Improve sector surface texture selection.
- **Work:** Replace floor and ceiling texture selects with the picker, ensuring Skybox logic remains unchanged:
  - ceil picker hidden when Skybox is effectively on
  - Skybox toggle behavior and automatic texture assignment on disable remain unchanged
- **Done when:** Floor/ceil selection works, and Skybox flow is unchanged.

## S009 — Integrate into Inspector: “Texture Walls” (paint all walls)
- **Intent:** Improve the “paint all walls in room” selection without changing workflow.
- **Work:** Replace the dropdown with the picker while preserving:
  - local state update only on selection (no auto-commit)
  - the “Set” button enable/disable rules
  - special entries like “(none)” and “(mixed)” where currently present
  - missing-texture display behavior
- **Done when:** “Set” still performs a single `map-edit/set-sector-wall-tex` edit, and the picker only chooses the candidate texture.

## S010 — Integrate into Settings: default wall/floor/ceiling texture
- **Intent:** Make settings defaults visual too.
- **Work:** Replace the three default texture dropdowns with the picker while preserving:
  - `(none)` → empty string UI state → persisted `null`
  - `(missing)` option behavior when current default is not available
  - disabled state when defaults are disabled
- **Done when:** Settings save/apply behavior is unchanged and values persist as before.

## S011 — Manual verification pass (UI)
- **Intent:** Compensate for node-only Jest environment.
- **Work:** Verify in a running app with an assets directory configured:
  - grid loads and scrolls with many textures
  - previews display correctly for png/jpg/webp (as available)
  - selection commits in inspector exactly as before
  - “Texture Walls” still requires Set
  - settings defaults still persist and are used elsewhere
- **Done when:** A short manual checklist is completed and recorded (e.g., in the PR description or a Phase verification note).

## S012 — Documentation update (L09)
- **Intent:** Keep subsystem docs current.
- **Work:** Update `docs/renderer-ui-system.md` to describe the Texture Select control and the UI locations it serves.
- **Done when:** Docs reflect the new UI component and its purpose.

## S013 — Quality gates
- **Intent:** Ensure repo stays green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All commands succeed.

## S014 — Texture Select UX polish (preview, width, theming)
- **Intent:** Address initial UX regressions found in manual use after integration.
- **Work:**
  - Ensure the selected texture preview renders even when the control is closed.
  - Ensure the control fills available horizontal space (especially in Settings).
  - Support a light theme for Settings and retain dark theme for the editor.
  - Re-run the quality gates after these UX changes.
- **Done when:**
  - Closed-state preview shows the selected texture thumbnail.
  - Settings default texture controls fill the FormGroup width.
  - Settings defaults render black-on-white while the editor remains white-on-dark.
  - Lint/typecheck/tests pass.

## S015 — Laws/style compliance follow-ups (L04, L07)
- **Intent:** Close review findings so the Phase can be approved.
- **Work:**
  - Address **L04** for `createBrowserObjectUrlAdapter` in `textureThumbnails.ts`:
    - Either add a node-environment unit test that validates our integration contract by mocking `globalThis.URL.createObjectURL`/`revokeObjectURL` and `globalThis.Blob`, or
    - Reduce the public API surface by making `createBrowserObjectUrlAdapter` non-exported (and adjust call sites), so it is no longer a public method requiring unit tests.
  - Address **L07** by updating the “Lifecycle expectations” comment in `textureThumbnails.ts` to accurately reflect the actual cache lifetime used by the renderer (currently per `TextureSelect` instance).
- **Done when:**
  - `createBrowserObjectUrlAdapter` no longer violates L04.
  - Lifecycle comments are accurate and consistent with implementation.
  - Lint/typecheck/tests pass.
