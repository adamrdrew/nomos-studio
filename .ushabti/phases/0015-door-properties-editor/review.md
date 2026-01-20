# Phase 0015 Review — Door Properties Editor (Required Item Fields)

## Summary
Adds editor support for door lock/key requirements: door Properties now exposes `required_item` and `required_item_missing_message`, and these values decode from maps and persist via existing `map-edit/update-fields` edits.

## Verified
Automated:
- `npm test` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS

Manual:
- User ran the editor and verified door properties are displayed/editable/saved.
- User verified the map runs in the engine with modified doors.

Code-level:
- Renderer map decoder/view model includes door `requiredItem` and `requiredItemMissingMessage` (null when missing).
- Inspector DoorEditor exposes both fields and commits snake_case JSON keys; empty input clears to null.
- Main edit/save tests cover round-trip and serialization of both fields.

## Issues
None found in unit tests.

## Required follow-ups
None.

## Decision
GREEN — Phase complete.

Validated against Phase acceptance criteria:
- Door Properties expose `required_item` and `required_item_missing_message` and commit via `map-edit/update-fields` (renderer-to-main IPC).
- Decode behavior is covered (present fields decode; missing defaults to null).
- Persistence/undo/redo behavior is covered by unit tests and user-verified in the running editor + engine runtime.

Validated against project laws/style:
- L03 maintained (renderer commits edits via preload API; no direct filesystem access added).
- L04 satisfied (behavioral changes backed by unit tests where applicable; automated suite passes).
- L09 satisfied (renderer UI doc updated for door Properties fields).

