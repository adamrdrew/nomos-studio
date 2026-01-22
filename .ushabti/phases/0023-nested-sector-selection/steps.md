# Phase 0023 — Steps

## S001 — Locate current sector picking + reproduce nested-sector failure
- **Intent:** Ground the fix in the actual renderer picking implementation and confirm the reported behavior.
- **Work:**
  - Find the Select-mode picking function used by both hover and click (per Phase 0021 policy).
  - Identify where sector picking is performed (point-in-sector logic, sector iteration order).
  - Reproduce: hover/click inside an inner sector currently highlights/selects the outer sector.
- **Done when:** The exact code path and a concrete repro scenario (fixture map or minimal synthetic geometry) are recorded for later verification.

## S002 — Decide and document the nested-sector tie-breaker
- **Intent:** Make the behavior predictable, reviewable, and testable.
- **Work:**
  - Choose one deterministic rule for “deepest sector”:
    - depth-based containment count, or
    - smallest absolute polygon area (only if overlap is not expected)
  - Define stable tie-breakers (epsilon rules + index ordering).
  - Ensure the rule applies only within the sector-picking fallback (after marker/door/wall checks).
- **Done when:** The rule is written into the picking module’s public docstring (or equivalent) and referenced by tests.

## S003 — Implement deepest-sector selection in the pure picking module
- **Intent:** Fix hover + click selection while preserving the Phase 0021 architecture (pure picking).
- **Work:**
  - Update the sector candidate selection to consider multiple containing sectors and apply the tie-breaker.
  - Ensure both hover preview and click selection use the exact same picking function.
  - Keep behavior unchanged when only one (or zero) sector contains the point.
- **Done when:** Manual repro now highlights/selects the inner sector under the cursor.

## S004 — Add unit tests for nested-sector picking
- **Intent:** Lock in the regression fix and satisfy L04 for the new decision branches.
- **Work:**
  - Add a minimal test fixture with nested sectors (outer polygon containing a smaller inner polygon).
  - Assert:
    - point inside inner => inner sector picked
    - point inside outer but outside inner => outer sector picked
  - Add tie-breaker coverage:
    - multiple containing sectors chooses the expected one deterministically
    - ties resolve by stable index rule
- **Done when:** Tests fail on the old behavior and pass with the new behavior.

## S005 — Verify interaction with wall/door/marker priority (non-regression)
- **Intent:** Ensure we don’t break the existing “least surprise” picking priority.
- **Work:**
  - Add/extend a test where a point is both inside a sector and near/on a wall/door/marker, asserting the higher-priority object still wins.
  - Confirm sector nested tie-breaker is only reached when sector picking is reached.
- **Done when:** Tests demonstrate priority order is preserved.

## S006 — Documentation update (if needed)
- **Intent:** Keep renderer docs truthful (L09).
- **Work:**
  - Update `docs/renderer-ui-system.md` to mention nested-sector behavior (innermost sector under cursor is selected).
- **Done when:** Docs no longer imply “first/outer sector wins” behavior.

## S007 — Quality gates + manual verification record
- **Intent:** Ship the phase green and capture verification for the Overseer.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manually verify on a map with nested sectors:
    - hover highlight follows inner vs outer as expected
    - click selects the same object highlighted
    - outer sector remains selectable by clicking its non-inner area
- **Done when:** All commands pass and verification notes are recorded in `review.md`.
