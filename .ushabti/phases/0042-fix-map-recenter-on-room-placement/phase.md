# Phase 0042 — Fix Map Recenter on Room Placement

## Intent
Fix the bug where placing the first room on a blank map causes the viewport to unexpectedly jump/recenter, which can move the newly placed room offscreen and disorient the user.

## Scope

### In scope
- Fix the viewport stability in MapEditorCanvas.tsx so that:
  - When geometry is added to a map, the view remains stable and does not jump.
  - When a blank map is opened, subsequent geometry additions do not trigger auto-zoom.
  - Existing behavior for opening a map with geometry remains unchanged (initial fit-to-bounds on open, then stable thereafter).

- Manual verification:
  - Open a blank map (or create a new map).
  - Place a room using the room tool.
  - The view does not move; the room appears where it was placed.

### Out of scope
- Changes to how rooms are created or placed.
- Changes to the pan/center/zoom commands (those remain manual user actions).
- Changes to the initial framing behavior when opening a map that already has geometry.
- Adding a configurable preference for auto-framing behavior.

## Root Cause Analysis

The original diagnosis was incomplete. There were **two interacting issues**:

### Issue 1: Dynamic mapOrigin shifting
The `mapOrigin` (center of map bounds, used for coordinate centering) was recalculated from `decodedMap` every time the map content changed. When the first room was added to a blank map:
- `mapOrigin` shifted from `{x: 0, y: 0}` to the center of the new room
- All render coordinates shifted (since `renderX = authoredX - mapOrigin.x`)
- The view offset stayed the same, causing a visual jump

### Issue 2: Initial scale effect triggering unexpectedly
The auto-framing `useEffect` (lines 715-756) did not set its guard ref when `mapBounds` was null. When the first room was added:
- `mapBounds` transitioned from null to valid
- The guard check passed (ref was still null)
- Auto-framing ran and changed the zoom level

Both issues needed to be fixed together. Fixing only Issue 2 (as originally planned) left the mapOrigin shift problem, which caused the major jump. Fixing only Issue 1 left the auto-zoom problem.

## Constraints
- **L01 Desktop Cross-Platform Parity:** The fix must work identically on macOS, Windows, and Linux (view transform logic is platform-agnostic).
- **L07 Truthful Naming:** If any comments or variable names suggest "initial framing only on open", ensure they remain accurate after the fix.

Style constraints (see `.ushabti/style.md`):
- Keep the fix minimal and localized.
- Preserve existing behavior for non-blank maps.
- Maintain clarity: the logic should be easy to read and audit.

## Acceptance criteria
- The viewport remains stable when geometry is added to any map (blank or not).
- The `mapOrigin` is stable within a map editing session (only updates when switching maps).
- Blank maps set the initial scale guard immediately, preventing auto-zoom when first geometry is added.
- Existing behavior remains intact:
  - Opening a map with geometry performs initial fit-to-bounds once.
  - Switching tools or resizing the window does not trigger unwanted recentering.
  - Pan/Zoom/Center commands continue to work as before.
- Manual verification passes:
  - Open a new or blank map.
  - Place a room — the viewport does not move.
  - Place additional rooms — no jumping occurs.
  - Open an existing map with geometry: initial fit-to-bounds still occurs as expected.

## Implementation Summary

### Fix 1: Stable mapOrigin (lines 382-410)
- Renamed the original memo to `computedMapOrigin` (computes origin from current bounds)
- Added `stableMapOriginRef` to store the origin when a map is first opened
- Created new `mapOrigin` memo that only updates the ref when `mapFilePath` changes
- Result: `mapOrigin` is stable within a session, preventing coordinate system shifts

### Fix 2: Blank map guard (lines 724-728)
- When `mapBounds === null`, set `lastInitialScaleMapRef.current = mapFilePath` before returning
- This marks blank maps as having had their initial framing applied
- Result: Adding geometry to blank maps does not trigger auto-zoom

## Verification
- All 682 tests pass
- Manual testing confirms the viewport remains stable when placing rooms on blank maps
- Existing fit-to-bounds behavior on map open is preserved
