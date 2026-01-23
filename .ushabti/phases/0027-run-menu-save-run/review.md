# Phase 0027 Review — Run Menu (Save & Run)

## Decision
Green. Phase is **complete**.

## Verified
- Acceptance criteria behavior:
	- Run menu exists; Save & Run uses `F5`; enabled/disabled tracks `canSave`.
	- Save & Run orchestration is save → validate → run.
	- Validation failure uses existing invalid-map messaging and shows report detail.
	- Run invocation uses `ProcessRunner.run({ command: settings.gameExecutablePath, args: [path.basename(mapPath)] })`.
- Testing gates:
	- Jest is green and now explicitly covers the “no open document” and “missing/blank gameExecutablePath” branches.
	- Typecheck and lint are green (lint emits only the upstream TS support warning).

## Issues
No blocking issues found.

## Notes
- Prior L09 mismatch in `docs/menu-system.md` (non-macOS Settings entrypoint) has been corrected.
- Lint output includes an upstream TypeScript-eslint support warning for TS 5.9.x; this does not fail lint and is not a Phase defect.

