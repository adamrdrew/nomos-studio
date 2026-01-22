# Phase 0025 — Review

## Summary

- Added `map-edit/create-door` atomic command (main) with portal + uniqueness validation, creates doors with `starts_closed: true` and no default `tex`, and selects the newly created door.
- Updated renderer door model/decode/UI to allow doors with unset texture (`tex: null`) so “no default tex” is representable.
- Added Door tool to the toolbox and implemented hover/click interaction with cursor feedback and IPC edit invocation.
- Updated docs for the map edit command system and renderer UI system.

## Verified

- Automated checks:
	- `npm test`
	- `npm run typecheck`
	- `npm run lint`

- Manual verification checklist (needs a human run in the app):
	- [x] Door tool button appears in the left toolbox and toggles active state.
	- [x] With Door tool active, cursor is `crosshair` over a portal wall with no door; otherwise `not-allowed`.
	- [x] Clicking a valid portal wall creates a door and selects it.
	- [x] Clicking a non-portal wall does nothing (no crash).
	- [x] Clicking a portal wall that already has a door does nothing (no crash).
	- [x] Newly created door has `starts_closed === true` and shows “(select texture)” in the Inspector.
	- [x] Undo removes the created door; redo re-adds it.

## Issues

- None noted.

## Required follow-ups

- None.

## Decision

GREEN — Phase complete. The work has been weighed and found complete.
