# Phase 0018 Review — Map Editor Ceiling Textures, Sky, Lighting, and Zoom

## Summary

Phase 0018 intent is met: the textured Map Editor can now toggle floor vs ceiling fills, supports SKY ceilings via map-level `sky`, visualizes sector base light via a black overlay, increases max zoom, and clamps/labels sector light editing as a 0..1 scalar.

## Verified

- Acceptance criteria: sector surface toggle exists (View → Floor Textures / Ceiling Textures) and affects only textured sector fills; wireframe mode is unchanged.
- Acceptance criteria: SKY ceiling rendering is case-insensitive and substitutes `Images/Sky/<map.sky>` when available; missing/empty/unloadable sky degrades gracefully (no crash; fill skipped); SKY renders at full brightness (no sector light overlay).
- Acceptance criteria: lighting visualization uses $\mathrm{darkness} = 1 - \mathrm{clamp01}(\mathrm{light})$ as a black overlay over textured sector fills (both floor and ceiling) and behaves correctly at extremes (0 → black, 1 → no overlay).
- Acceptance criteria: zoom cap increased to 64 and both wheel zoom and toolbar zoom respect the clamp.
- Acceptance criteria: Properties inspector edits sector `light` with explicit range labeling (`light (0..1)`) and clamps out-of-range values on commit.

- Laws/style:
	- L01: no platform-specific behavior introduced beyond existing menu platform branching.
	- L02: no network dependency introduced; textures loaded via existing local asset byte reads.
	- L03: no widened preload/IPC capability surface; only snapshot data shape extended.
	- L04: new/changed public APIs have unit tests covering conditional paths (`AppStore.setMapSectorSurface`, `AppStore.toggleMapSectorSurface`, and menu template wiring).
	- L05: texture cache remains bounded (64) with deterministic `URL.revokeObjectURL` cleanup on eviction and lifecycle clear.
	- L09: docs updated for menu + renderer behavior.

- Quality gates: user-provided runs show `npm run lint` (0 warnings), `npm test` (27/27 suites passing), and `npm run typecheck` passing.

## Issues

- Non-blocking: ESLint emits a warning that the repository is using TypeScript 5.9.3, which is outside the supported range of `@typescript-eslint/typescript-estree` (<5.6.0). This did not fail lint and appears pre-existing/tooling-level, not introduced by Phase 0018.

## Required follow-ups

None required for Phase 0018 acceptance.

## Decision

GREEN — complete. The work has been weighed and found true.

