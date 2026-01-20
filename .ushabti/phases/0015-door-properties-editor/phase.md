# Phase 0015 — Door Properties Editor (Required Item Fields)

## Intent
When a door is selected in the Map Editor, the Inspector **Properties** panel must display the door’s full editable authoring surface, including gameplay-gated door fields that are currently not exposed:
- `required_item`
- `required_item_missing_message`

This Phase exists now because authors need to set door lock/key requirements and the corresponding user-facing message, and those values must round-trip through the editor and persist with the saved map.

## Scope

### In scope

#### A) Door properties: display and edit required-item fields
- In the Properties panel for selection kind `door`, display and edit:
  - `required_item` (string | null)
  - `required_item_missing_message` (string | null)
- Edits must be committed via the existing `map-edit/update-fields` atomic command so they are undoable and persist in `MapDocument.json`.

#### B) Door properties: ensure all door fields are visible
- The door Properties panel must continue to show existing door fields already supported by the editor:
  - `id` (read-only)
  - `wall_index` (read-only)
  - `tex` (editable)
  - `starts_closed` (editable)

#### C) Map decode support for optional door fields
- Extend renderer-side map decoding/view-model shaping so that a door selection can surface optional `required_item` and `required_item_missing_message` values when present in the map JSON.

### Out of scope
- Changing the map validator/game runtime behavior.
- Introducing new IPC channels or widening preload surface area (L03).
- Editing door identity fields (`doors[].id`) or structural references (`doors[].wall_index`).
  - Rationale: `id` participates in selection identity (`MapEditTargetRef.kind:'door'` by id); supporting id edits would require selection remapping and additional invariants.
- Adding new door schema fields beyond the two requested.

## Constraints
- **L03 (Electron security):** Renderer must continue to commit changes through `window.nomos.map.edit(...)`; no direct filesystem access.
- **L04 (Testing):** Any changed public method must have unit tests covering conditional paths.
  - Renderer map decoding is exercised by unit tests in `src/renderer/ui/editor/map/mapDecoder.test.ts`; extend them to cover the new optional door fields.
- **L09 (Docs):** Update subsystem docs under `docs/` if their described Properties behavior or door data shapes become inaccurate.
- Style guide:
  - Keep domain/persistence logic in main; renderer only edits via commands.
  - Avoid new dependencies.

## Assumptions (explicit)
- Map door entries may omit `required_item` and/or `required_item_missing_message`.
- When absent, these fields should be treated as `null` (not empty string) for round-trip clarity.
- The on-disk schema uses snake_case JSON keys as shown in the example (`required_item`, `required_item_missing_message`).

## Acceptance criteria

### Door properties: UI
- Selecting a door shows a Properties editor with fields:
  - id (read-only)
  - wallIndex (read-only)
  - texture (editable)
  - startsClosed (editable)
  - requiredItem (editable)
  - requiredItemMissingMessage (editable)
- Required-item UX rules are clear and non-crashy:
  - Empty required item clears the value (commits `null`).
  - Missing message can be edited independently, and can be cleared to `null`.

### Persistence + undo/redo
- Editing `required_item` and `required_item_missing_message` commits via `map-edit/update-fields` to the selected door target.
- Save + reopen preserves the edited values in the map JSON.
- Undo/redo restores prior values for both fields.

### Decode behavior
- If a map contains door entries with the two optional fields, they decode into the renderer view model and appear in the Properties panel.
- If they are missing, the editor treats them as `null` and does not throw.

### Verification
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Manual smoke (interactive Electron):
  - Open a map containing a door with `required_item` and `required_item_missing_message`.
  - Select the door → see both fields populated.
  - Edit both fields → save → reopen → values persist.
  - Undo/redo toggles edits as expected.

## Risks / notes
- If the runtime/validator expects these fields only when `required_item` is present, the editor should avoid writing inconsistent combinations where possible (e.g., allow message to be null).
- Door selection identity is id-based; this Phase avoids editing `id` to prevent selection/target-ref drift.
