# Review — Phase 0039: Wall Slice Tool (Split)

## Summary
Phase implements the Split wall tool end-to-end (renderer → typed IPC → main command engine), including deterministic closest-point splitting, portal/door safety constraints, undo/redo compatibility, and updated UX affordances (hover highlight + cursor).

## Verified
- Laws/style inputs reviewed: `.ushabti/laws.md`, `.ushabti/style.md`.
- Acceptance criteria:
	- Tool presence: Split appears in toolbox with label/tooltip and a clear scissors/cut icon.
	- Split behavior: Split click issues exactly one `window.nomos.map.edit` request, uses closest-point projection, rejects non-wall hits and endpoint-adjacent splits, preserves wall properties, and maintains wall index stability.
	- Undo/redo: Implemented as a single atomic edit via main-owned history; selection reconciliation is explicit/deterministic.
	- Docs: Updated map edit command docs and renderer UI docs.
	- Quality gates: lint/typecheck/tests are green (eslint exit 0, tsc exit 0, full Jest suite passing).
- L03: Renderer does not mutate map JSON directly; edits go through typed preload IPC.
- L04/L08: New behavior is covered by unit tests (main command engine branches; renderer pure helper tests).

## Issues

None.

## Required follow-ups

None.

## Decision

Green — Phase 0039 is complete and weighed correct against laws, style, and acceptance criteria.

