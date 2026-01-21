# Phase 0019 Review — File Menu + File Handling Enhancements

## Summary
Phase intent is implemented (New Map, Save As…, Recent Maps persistence, asset double-click routing, unsaved-changes guard, quit/close guard). Automated quality gates and reported manual testing indicate the flows work.

S012/S013 were implemented to address the previously identified L04 gaps; tests now exist for the new exported renderer router and additional open-from-assets + recent persistence error handling.

However, the Phase is still not green due to a remaining L04 compliance gap in the new recent-maps persistence repository: Windows-safe-replace branches (EPERM/EEXIST backup/restore flow) are not yet covered by unit tests.

## Verified
- Acceptance criteria appear satisfied in the implementation:
	- New Map clears document/history/selection via `UnsavedChangesGuard`.
	- Save As… uses a save dialog and writes via safe replace, updating `MapDocument.filePath` and `dirty: false`.
	- Open/New/Recent/Asset-open/quit paths are guarded by Save/Don't Save/Cancel.
	- Asset Browser double-click opens `Levels/*.json` in-editor via new IPC; non-maps open via OS.
	- Recent Maps is capped at 5, deduped, persisted under `userData/recent-maps.json`, and is resilient to missing/invalid JSON.
	- Quit/close guard is re-entrancy-safe via an `isQuitInProgress` flag.

- L01/L02/L03/L06/L08/L09: no blocking violations found in the reviewed changes.
- Quality gates reported passing: tests, typecheck, lint.

## Issues
- Remaining L04 gap: `JsonFileRecentMapsRepository.saveRecentMapPaths(...)` has untested conditional paths for Windows-style rename errors (EPERM/EEXIST) requiring backup-then-replace and restore best-effort behavior.
	- This is visible in the current coverage report: `JsonFileRecentMapsRepository.ts` has uncovered lines corresponding to the Windows-safe-replace helpers.

## Required follow-ups
- Complete S014:
	- Add branch-complete unit tests for Windows-safe-replace behavior in `JsonFileRecentMapsRepository.saveRecentMapPaths(...)`.

## Decision
NOT GREEN.

Phase status remains `building` until S014 is completed and verified.
