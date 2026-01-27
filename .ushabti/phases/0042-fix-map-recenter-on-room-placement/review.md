# Phase 0042 — Review

## Summary
Fixed a viewport jump bug that occurred when placing the first room on a blank map. The fix required two coordinated changes in MapEditorCanvas.tsx:

1. **Stable mapOrigin** (lines 382-412): Made the map coordinate system origin stable within a map session by storing it in a ref that only updates when `mapFilePath` changes, not when content is edited. This prevents render coordinate shifts when geometry is added or modified.

2. **Blank map guard** (lines 724-728): Set the initial scale guard immediately when `mapBounds === null`, marking blank maps as having had their initial framing applied. This prevents auto-zoom from triggering when first geometry is added.

The original diagnosis identified only the guard issue (Issue 2), but investigation revealed that both issues needed to be fixed together to fully resolve the viewport jump.

## Verified

### Acceptance Criteria (all satisfied)

1. **Viewport stability when geometry is added** ✓
   - Verified in code: `mapOrigin` is stable within a session (only updates on `mapFilePath` change)
   - Verified in code: blank maps set the initial scale guard immediately
   - Manual verification confirmed by user (step S004)

2. **mapOrigin is stable within a map editing session** ✓
   - Implementation: `stableMapOriginRef` stores origin keyed by `mapFilePath`
   - Ref only updates when `mapFilePath !== stableMapOriginRef.current.mapFilePath`
   - `mapOrigin` memo returns the stable value from the ref

3. **Blank maps set initial scale guard immediately** ✓
   - Implementation: lines 724-728 set `lastInitialScaleMapRef.current = mapFilePath` when `mapBounds === null`
   - Comment clearly explains purpose

4. **Existing behavior remains intact** ✓
   - Initial framing useEffect (lines 698-713) unchanged
   - Initial scale useEffect logic preserved, only added blank map guard
   - Test suite passes: 682 tests (step S005)

5. **Manual verification passes** ✓
   - User confirmed blank map room placement does not move viewport (step S004)
   - User confirmed subsequent room placements do not jump (step S004)

### Law Compliance

- **L01 Desktop Cross-Platform Parity:** ✓ View transform logic is platform-agnostic; no platform-specific code introduced.
- **L04 Testing Policy:** ✓ No new public APIs were added. The change is internal to MapEditorCanvas. Test suite passes (682 tests).
- **L07 Truthful Naming:** ✓ New names are accurate:
  - `computedMapOrigin` computes origin from current bounds (used to initialize stable origin)
  - `stableMapOriginRef` stores the stable origin
  - `mapOrigin` is the stable origin used for rendering
  - Comment at line 399-400 accurately describes the purpose
  - Comment at line 725-726 accurately describes the guard behavior
- **L08 Design for Testability:** ✓ No testability issues introduced.
- **L09 Subsystem Documentation:** ✓ The renderer-ui-system.md documentation at line 159 mentions the render-only origin offset. The current documentation is sufficient (it describes the origin offset as an implementation detail). The Phase documentation provides full implementation details.

### Style Compliance

- **Minimal, localized fix:** ✓ Changes are confined to MapEditorCanvas.tsx, lines 382-412 and 724-728.
- **Existing behavior preserved:** ✓ No changes to non-blank map behavior.
- **Clear, auditable logic:** ✓ Comments explain purpose. Naming is truthful. Logic is straightforward.
- **Honest naming:** ✓ All new symbols accurately reflect their behavior (see L07 verification above).

### Step Verification

- **S001 (Investigate root cause):** ✓ Implemented and complete. Root cause fully understood (two interacting issues).
- **S002 (Fix mapOrigin stability):** ✓ Implemented and complete. Code at lines 382-412 implements stable origin.
- **S003 (Fix blank map guard):** ✓ Implemented and complete. Code at lines 724-728 sets guard for blank maps.
- **S004 (Manual testing):** ✓ Implemented and complete. User confirmed fix works.
- **S005 (Test suite):** ✓ Implemented and complete. All 682 tests pass.

## Issues

None. The implementation is correct, complete, and complies with all laws and style requirements.

## Required follow-ups

None. The Phase is complete.

## Decision

**Approved: Green**

The work has been weighed and found complete. All acceptance criteria are satisfied. All steps are implemented and verifiable. No law violations exist. Style compliance is acceptable. Tests pass. The Phase is correct.
