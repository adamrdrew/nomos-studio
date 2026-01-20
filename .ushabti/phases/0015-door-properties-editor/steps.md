# Phase 0015 Steps — Door Properties Editor (Required Item Fields)

## S001 — Confirm current door schema and current Properties behavior
- **Intent:** Anchor the change to the actual map schema and current UI behavior.
- **Work:**
  - Identify the current door Properties editor implementation and what it already edits (`tex`, `starts_closed`).
  - Confirm the existing door decode shape in the renderer view model (currently `id`, `wall_index`, `tex`, `starts_closed`).
  - Confirm that main-process map edits for doors route through `map-edit/update-fields` with target `{ kind: 'door', id }`.
  - Capture a minimal sample map JSON fixture that includes both new door fields.
- **Done when:** The file touch list + a representative JSON sample is recorded in Phase notes.

## S002 — Extend renderer map decoding/view model for optional door fields
- **Intent:** Ensure the selection model can surface the new properties.
- **Work:**
  - Extend the `MapDoor` view model type to include:
    - `requiredItem: string | null`
    - `requiredItemMissingMessage: string | null`
  - Update the door decoder to read:
    - `required_item` as optional string (null when missing)
    - `required_item_missing_message` as optional string (null when missing)
  - Ensure decode failures remain precise and do not regress existing maps.
- **Done when:** A map containing the optional keys decodes successfully, and maps without them still decode successfully.

## S003 — Add required-item fields to the door Properties editor
- **Intent:** Provide a complete door authoring surface in the Inspector.
- **Work:**
  - Update the door Properties editor UI to display and edit:
    - `required_item` (text input; empty → commit null)
    - `required_item_missing_message` (text input or textarea; empty → commit null)
  - Commit edits via `map-edit/update-fields` with the correct snake_case JSON keys.
  - Ensure the UI stays in sync when selection changes (use `selectionKey` reset pattern already used in the file).
- **Done when:** Selecting a door shows both fields, and editing either commits a map edit without errors.

## S004 — Round-trip + undo/redo validation (automated)
- **Intent:** Ensure correctness end-to-end: edit → history → save → reload.
- **Work:**
  - Add/extend main-process unit tests to verify door update-fields edits apply to the correct door target by id.
  - Add/extend tests to verify undo/redo restores prior values for both new fields.
  - Add/extend tests to verify Save writes the updated JSON (including the new keys) and that reloading the saved JSON restores the values.
- **Done when:** Unit tests demonstrate edit/undo/redo and save+reload round-trip for both fields.

## S005 — Unit tests for door decoding + update-fields behavior
- **Intent:** Keep coverage aligned with L04 and prevent regressions.
- **Work:**
  - Extend `src/renderer/ui/editor/map/mapDecoder.test.ts` to cover:
    - decoding a door with `required_item` and `required_item_missing_message`
    - decoding a door without those fields (defaults to null)
  - If adding/changing any public method signature or behavior, update/add tests to cover conditional paths.
  - If existing map edit tests do not already cover door `update-fields` with arbitrary keys, add a focused test that updates these two keys on a door record and verifies the JSON changed as expected.
- **Done when:** Tests cover both presence/absence cases and all checks pass.

## S006 — Docs update (only if needed)
- **Intent:** Maintain subsystem documentation truthfulness (L09).
- **Work:**
  - Update `docs/renderer-ui-system.md` if it needs to mention door Properties fields/editing.
  - Update `docs/maps-system.md` only if it documents door field shapes (avoid speculative schema docs).
- **Done when:** Any affected doc accurately reflects the new Properties behavior.

## S007 — Verification pass
- **Intent:** Complete the Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual smoke:
    - select door with required fields → values visible
    - edit required item + message → undo/redo works
    - save + reopen → values persist
- **Done when:** Automated checks pass and manual smoke results are recorded for Overseer review.
