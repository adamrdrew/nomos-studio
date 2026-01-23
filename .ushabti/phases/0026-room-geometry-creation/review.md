# Phase 0026 — Review

## Summary

- Room tool adjacent placement supports joins where the new room edge is equal to or longer than the target wall (no forced scaling-down).
- Fixed the hall-end repro by allowing T-junction endpoint touches (endpoint-on-segment) during snapped-adjacent intersection checks.
- Implemented player start editing (engine verification blocker):
	- Map-root JSON: `player_start: { x, y, angle_deg }`.
	- Inspector Map Properties controls (X/Y/Angle + Pick/Cancel).
	- Canvas pick mode + marker rendering (circle + vision cone).
	- Main-owned atomic command `map-edit/set-player-start` with finite-number validation.


## Verified

- Automated quality gates:
	- `npm test` (pass; exit 0)
	- `npm run typecheck` (pass)
	- `npm run lint` (FAIL: react-hooks/exhaustive-deps warning; max-warnings=0)

- Manual editor verification:
	- Adjacent placement works for the hall-end repro (larger room attaching to a shorter wall) without scaling down.
	- Player start:
		- Angle editing persists (does not revert to 0 during editing).
		- Pick mode sets X/Y and preserves the current angle.
		- Marker renders in the correct place with correct orientation.


## Issues

- **Blocking:** `npm run lint` fails due to a `react-hooks/exhaustive-deps` warning in `MapPropertiesSection.tsx`.
- **Blocking (L04):** Jest coverage output shows uncovered conditional branches in `src/shared/domain/mapRoomGeometry.ts` (notably `computeAdjacentPortalPlan` error returns and `computeRoomPlacementValidity` branches such as `invalid-size` / nested-intersects), indicating missing unit test coverage of conditional paths for exported helpers.


## Required follow-ups

- **S029:** Fix the lint failure while preserving the player start angle editing behavior.
- **S030:** Add missing unit tests for `mapRoomGeometry` exported helpers to satisfy L04 conditional path coverage.
- **S031:** Expand `MapCommandEngine` create-room tests to cover remaining meaningful failure branches.
- Engine-side verification: confirm runtime consumes `player_start.angle_deg` (degrees) and matches the editor’s rotation convention.
- Optional UX polish: surface `map-edit/set-player-start` failures to the user (toaster) in addition to console logging.


## Decision

Not ready for Overseer sign-off; returned to building for S029–S031.

