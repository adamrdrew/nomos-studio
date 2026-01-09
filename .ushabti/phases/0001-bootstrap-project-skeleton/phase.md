# Phase 0001 — Bootstrap Project Skeleton

## Intent
Establish the project skeleton and tooling for the cross-platform Electron map editor (this corresponds to the user’s “Phase 0”). The outcome is a repository that installs, validates, builds, runs locally offline, and opens a desktop window that renders a minimal UI shell using the chosen UI stack.

No map data model, editor logic, or game-engine-specific behavior is introduced in this Phase.

## Scope

### In scope
- Electron app bootstrap (main + preload + renderer separation) following Electron security best practices.
- React renderer shell that renders *something visible* in the window.
- Add and wire baseline dependencies so they compile:
  - Electron (host/bootstrap)
  - React + TypeScript (strict)
  - Zustand (state wiring allowed, no domain logic)
  - Blueprint.js (render at least one component)
  - DockView (render a minimal dock layout)
  - React Konva (render a minimal stage/shape)
- Tooling and scripts:
 - Tooling and scripts (selected for maturity and broad adoption):
  - Electron Forge using the Webpack + TypeScript templates
  - Install/build/dev scripts
  - Type-checking
  - Linting (if adopted)
  - Unit test harness configured
  - CI (or equivalent) running on macOS/Windows/Linux
- Minimal tests that verify *our* bootstrapping decisions without testing third-party/framework behavior.

### Out of scope
- Any persistent project format (maps, levels, palettes, entities).
- Undo/redo, tools, selections, grid, snapping, import/export.
- Rendering correctness for Konva shapes beyond “it mounts and draws a trivial shape.”
- Complex state management patterns or application services.
- Packaging/signing/notarization and distributable installers (can be a later Phase).

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - L01 (macOS/Windows/Linux parity)
  - L02 (offline local operation)
  - L03 (Electron security best practices)
  - L04 (tests for public methods and conditional paths)
  - L08 (design for testability)
- Must follow `.ushabti/style.md`:
  - strict TypeScript, careful naming, small single-purpose methods, composition/DI, minimal conditionals.

## Acceptance criteria
- Repository bootstraps successfully:
  - `npm run typecheck` succeeds.
  - `npm test` succeeds.
  - `npm run build` succeeds on the developer’s current OS.
- Local offline runtime:
  - `npm run dev` launches an Electron window and renders a visible UI shell.
  - The app does not require network connectivity to launch or render the UI shell.
- UI shell includes proof-of-wiring (no app logic):
  - Blueprint.js component renders.
  - DockView renders at least one panel.
  - React Konva renders a minimal stage/shape.
- Electron security posture is demonstrably set in code (reviewable):
  - Renderer has no direct Node.js access.
  - A minimal preload bridge exists (even if it exposes zero/near-zero APIs initially).
  - No remote content is loaded as app code.
- Tests:
  - Unit tests exist for any public bootstrap/config functions introduced.
  - Tests validate our configuration/contracts (e.g., window webPreferences choices) rather than Electron internals.
- Cross-platform gate:
  - CI (or equivalent) runs `npm test` and `npm run typecheck` on macOS, Windows, and Linux.

## Risks / Notes
- Toolchain is intentionally fixed for this Phase: Electron Forge + Webpack templates (mature, widely deployed, and aligned with Electron’s ecosystem). Packaging/signing can be introduced later if needed.
- Dev server usage is acceptable if it binds locally (e.g., 127.0.0.1) and does not require external network.
- Keep the initial public API surface tiny to reduce required testing and blast radius.
