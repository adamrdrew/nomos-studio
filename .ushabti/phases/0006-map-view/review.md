# Phase 0006 Review — Map View

## Summary
Phase 0006 implements the Map View subsystem (wireframe + textured rendering, selection/properties, validation gating, state refresh) and includes UX refinements (initial framing/origin semantics, adaptive grid, zoom-invariant markers) plus fixes for textured rendering under CSP and wall thickness per mode.

## Verified

Acceptance criteria:
- **Map renders in the Map Editor panel:** Verified by implementation + user confirmation (“Looks good”).
- **Pan/zoom still work:** Verified by implementation + user confirmation.
- **Map spawn/origin and framing:** Verified by implementation + user confirmation.
- **Default scale and zoom bounds are usable:** Verified by implementation + user confirmation.
- **Markers remain readable at any zoom:** Verified by implementation + user confirmation.
- **Wireframe render mode:** Verified by implementation + user confirmation.
- **Textured render mode:** Verified by implementation + user confirmation.
- **Textured rendering is not blocked by CSP:** Verified by
	- code/config changes that add `blob:` to `img-src` in both dev and prod CSP, and
	- absence of the previously-reported CSP `blob:` refusal errors in your subsequent run output.
- **Walls are appropriately thin/thick per mode:** Verified by implementation + user confirmation.
- **View menu toggles mode:** Verified by implementation + user confirmation.
- **Entities/emitters markers:** Verified by implementation + user confirmation.
- **Selection shows Properties:** Verified by implementation + user confirmation.
- **Validation gating + error dialog:** Verified by existing unit tests (`OpenMapService.test.ts`) and implementation.
- **Quality gates:** Verified by user-reported runs:
	- `npm run lint` (pass; non-fatal `@typescript-eslint` TypeScript version support warning)
	- `npm run typecheck` (pass)
	- `npm run test --coverage` (22 suites, 116 tests; pass)

Law/style checks:
- **L03 (Electron security):** Renderer still uses preload/IPC for privileged ops; CSP changes are narrowly scoped to `img-src` and do not relax production `script-src`.
- **L05 (Resource safety):** Texture cache remains bounded and revokes object URLs.
- **L09 (Docs):** Updated renderer UI docs to reflect CSP + texture strategy.

Note: Electron prints a dev-only warning about `unsafe-eval` in CSP; production CSP remains `script-src 'self'`.

## Issues
None outstanding.

## Required follow-ups
None.

## Decision
The work has been weighed and found complete: Phase 0006 is green.
