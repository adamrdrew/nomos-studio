# Phase 0042 — Steps

## S001: Investigate and confirm root cause
**Intent:** Identify why the viewport jumps when placing the first room on a blank map.

**Work:**
- Examined the auto-framing useEffect in MapEditorCanvas.tsx (lines 699-740).
- Initial hypothesis: guard ref not set when mapBounds is null.
- First fix attempt (guard only) failed — still caused major jump.
- Deeper investigation revealed the primary cause: `mapOrigin` was recalculated every time `decodedMap` changed.
- When first room added: mapOrigin shifts from (0,0) to room center, shifting all render coordinates.
- The view offset stays the same, so content appears to jump.

**Done when:**
- Root cause fully understood: two interacting issues (mapOrigin shift + scale guard).

---

## S002: Fix the mapOrigin stability
**Intent:** Prevent mapOrigin from shifting when content is edited within a map session.

**Work:**
- Renamed original `mapOrigin` memo to `computedMapOrigin` (still computes center of bounds).
- Added `stableMapOriginRef` to store the origin value when a map is first opened.
- Created new `mapOrigin` memo that:
  - Updates the ref only when `mapFilePath` changes (new map opened).
  - Returns the stable origin from the ref (not the dynamically computed one).
- Result: mapOrigin is stable within a session, only updating when switching maps.

**Files touched:**
- `src/renderer/ui/editor/MapEditorCanvas.tsx` (lines 382-410)

**Done when:**
- mapOrigin no longer shifts when geometry is added/modified.

---

## S003: Fix the initial scale guard for blank maps
**Intent:** Prevent auto-zoom when first geometry is added to a blank map.

**Work:**
- Modified the auto-framing useEffect (lines 715-756).
- When `mapBounds === null`, set `lastInitialScaleMapRef.current = mapFilePath` before returning.
- Added comment explaining the purpose.
- Result: blank maps are marked as "framed" immediately, preventing auto-zoom on first geometry.

**Files touched:**
- `src/renderer/ui/editor/MapEditorCanvas.tsx` (lines 724-728)

**Done when:**
- Adding geometry to blank maps does not trigger auto-zoom.

---

## S004: Test the fix manually
**Intent:** Verify that the bug is fixed and existing behavior is preserved.

**Work:**
- Test case 1: Blank map first room placement
  - Create a new map or open a blank map.
  - Use the room tool to place a room.
  - Confirm the viewport does not move; the room remains visible where it was placed. ✓
- Test case 2: Subsequent room placements
  - Place additional rooms.
  - Confirm the viewport does not jump. ✓
- Test case 3: Opening a map with existing geometry
  - Open a map that already has geometry.
  - Confirm the initial fit-to-bounds occurs as expected.

**Done when:**
- All manual test cases pass.
- User confirms the fix resolves the issue.

---

## S005: Run test suite
**Intent:** Ensure no regressions.

**Work:**
- Run `npm test`.
- All 682 tests pass.

**Done when:**
- Test suite passes.
- Phase is ready for Overseer review.
