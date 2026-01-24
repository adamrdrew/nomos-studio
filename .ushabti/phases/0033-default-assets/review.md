# Review — Phase 0033 Default assets

## Summary
Implemented project-wide default assets in Settings (sky/soundfont/MIDI + wall/floor/ceiling textures), persisted them in settings JSON with unknown-key preservation, and applied defaults to new map creation and room/sector creation. Automated checks are green and a manual smoke was reported successful.

## Verified
- Laws/style inputs reviewed: `.ushabti/laws.md` (L01/L02/L03/L04/L08/L09), `.ushabti/style.md` boundaries and testability guidance.
- Settings model and persistence:
	- `EditorSettings` includes all six new default fields (`string | null`).
	- Settings file codec reads/writes the new keys and preserves unknown keys (forward-compat).
	- Settings repository defaults include new keys.
- Settings UI (settings mode):
	- “Default assets” dropdowns exist for sky, soundfont, background MIDI, and wall/floor/ceiling textures.
	- Controls are disabled until assets directory is configured and `assetIndex` is available.
	- While assets are configured but `assetIndex === null`, UI shows a spinner with “Indexing assets…”, and dropdowns later enable without closing/reopening.
	- Each dropdown supports clearing to None (stored as `null`).
	- Dropdown option sources match required prefixes (`Images/Sky/`, `Sounds/SoundFonts/`, `Sounds/MIDI/`, and textures from `Images/Textures/` with fallback `Assets/Images/Textures/`).
- Defaults applied to new content:
	- New map JSON includes `sky`, `soundfont`, `bgmusic` when defaults are set (non-empty after trim).
	- Room tool create-room defaults prefer configured wall/floor/ceiling textures when all are set and available; otherwise fall back to first-three heuristic; blocks when <3 usable textures.
- Testing (L04):
	- Unit tests cover new conditional paths for settings merge semantics and map/default selection logic.
	- Verified green checks via node-invoked tools:
		- Jest: 45/45 suites, 510/510 tests
		- Typecheck: previously confirmed `EXIT:0`
		- Lint: passes (warning only).
- Documentation (L09):
	- Settings subsystem docs describe new keys and semantics.
	- Renderer UI docs updated for Settings default-asset UI and room texture default override behavior.

## Issues
- Tooling warning (non-blocking): ESLint reports `@typescript-eslint/typescript-estree` does not officially support TypeScript 5.9.3; lint still passes. This Phase did not introduce the mismatch but it remains a repo risk if the parser breaks in future.

## Required follow-ups
- None for Phase acceptance.

## Decision
Phase is GREEN. Acceptance criteria satisfied; work is weighed and found complete.
