# Phase 0028 Review — Sectors Start At 0

## Summary
Fixed seed room creation to allocate sector ids starting at `0` (instead of `1`), updated unit tests to lock the invariant, and updated docs to match.

## Verified
- **Acceptance criteria**
	- Seed room creation on an empty map selects `{ kind: 'sector', id: 0 }` (unit test updated).
	- Seed room walls use `front_sector: 0` and `back_sector: -1` (unit test updated).
	- Subsequent sector allocation increments from the max id (`0 → 1`) (regression test added: seed then nested).
	- `docs/map-edit-command-system.md` now states seed placement allocates `0`.
- **Laws**
	- L01: No platform-specific behavior introduced (pure deterministic logic change).
	- L04: Behavioral change is covered by unit tests.
	- L09: Docs updated in the same change.
- **Style**
	- Minimal, targeted change at the allocation site; no new dependencies; tests remain readable and deterministic.
- **Gates**
	- Jest (runInBand): pass.
	- Typecheck: pass.
	- Lint: pass (only the known upstream TypeScript-eslint support warning).
- **Manual verification**
	- User verified creating a map from a blank slate works.

## Issues
No blocking issues found.

## Required follow-ups
None.

## Decision
Green. Phase is **complete**.
