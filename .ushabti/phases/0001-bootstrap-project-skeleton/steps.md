# Phase 0001 Steps — Bootstrap Project Skeleton

## S001 — Select toolchain and repository layout
- **Intent:** Choose a bootstrap toolchain that supports strict TypeScript, React renderer, and cross-platform dev/build.
- **Work:**
  - Use Electron Forge + Webpack template + React + TypeScript (chosen for maturity and wide deployment).
  - Treat electron-builder as a later-phase packaging concern (out of scope for this bootstrap phase).
  - Define high-level folders: `src/main`, `src/preload`, `src/renderer`, and `src/shared` (types only in this Phase).
  - Decide Node/package manager policy (default: npm + `package-lock.json`).
- **Done when:** The chosen toolchain and folders are documented in the repo (README or similar) and used by the generated skeleton.

## S002 — Scaffold Electron + React + TypeScript skeleton
- **Intent:** Produce a runnable app with the correct process boundaries.
- **Work:**
  - Initialize `package.json`, TS configs, and build scripts.
  - Ensure main/preload/renderer entrypoints exist.
  - Ensure dev mode runs and production build can be produced.
- **Done when:** `npm run dev` opens an Electron window, and `npm run build` completes on at least one OS.

## S003 — Add UI stack dependencies (compile-time proof)
- **Intent:** Ensure the dependency stack is installed and wired at the UI boundary.
- **Work:**
  - Add Zustand, Blueprint.js, DockView, react-konva (+ konva) and their peer deps.
  - Render a minimal visible UI shell that includes:
    - One Blueprint component
    - One DockView panel
    - One Konva Stage with a trivial shape
- **Done when:** The renderer builds and the visible UI renders without runtime errors.

## S004 — Establish Electron security baseline
- **Intent:** Bake in best practices from day one.
- **Work:**
  - Enforce `contextIsolation: true`, `nodeIntegration: false`, and minimal permissions.
  - Preload exposes a minimal, explicit API surface (can be empty initially).
  - Ensure production loads local assets (no remote content as app code).
- **Done when:** Security-sensitive options are set in code and can be verified by inspection.

## S005 — Strict TypeScript configuration
- **Intent:** Use the type system as a guardrail early.
- **Work:**
  - Enable strict TS options.
  - Ensure path aliases (if used) work in both build and tests.
  - Keep shared types isolated from Electron/React imports.
- **Done when:** `npm run typecheck` passes and strictness is enabled.

## S006 — Add unit test harness (no framework behavior tests)
- **Intent:** Make testing first-class without locking into brittle patterns.
- **Work:**
  - Add a unit test runner appropriate for TS (e.g., Vitest or Jest) with clear separation between node tests and browser-like tests.
  - Configure coverage reporting.
  - Establish conventions so tests focus on our code’s contracts rather than third-party/framework behavior.
- **Done when:** `npm test` runs locally and in CI, producing a coverage report.

## S007 — Add minimal unit tests for bootstrap/config seams
- **Intent:** Satisfy L04/L08 while keeping scope minimal.
- **Work:**
  - Extract any bootstrapping decisions into small, public, testable functions (e.g., window options factory).
  - Write unit tests that cover conditional paths in those functions (if any).
  - Avoid assertions about Electron internals; assert our configuration and our integration contract.
- **Done when:** At least one meaningful unit test exists that verifies our own bootstrap configuration.

## S008 — Add linting/formatting and repo scripts
- **Intent:** Standardize dev workflow and reduce regressions.
- **Work:**
  - Add `npm run lint` (if adopted), `npm run typecheck`, `npm test`, `npm run dev`, `npm run build`.
  - Ensure scripts are cross-platform (no bash-only assumptions).
- **Done when:** Scripts exist, documented, and run on macOS/Windows/Linux.

## S009 — CI matrix on macOS/Windows/Linux
- **Intent:** Enforce L01 and keep the skeleton healthy.
- **Work:**
  - Add GitHub Actions workflow that runs `npm ci`, `npm run typecheck`, and `npm test` on macOS/Windows/Linux.
  - Avoid network-based service dependencies beyond dependency installation.
- **Done when:** CI runs on all three OSes and reports success on a green run.

## S010 — Manual verification checklist (developer-facing)
- **Intent:** Make “it works” reproducible for reviewers.
- **Work:**
  - Document exact commands and expected behavior:
    - dev launch opens a window
    - minimal UI shell visible
    - offline launch still works
  - Document any known limitations of the bootstrap.
- **Done when:** A reviewer can follow the checklist and confirm the acceptance criteria.

## S011 — CI uses reproducible installs (`npm ci`)
- **Intent:** Ensure cross-platform CI is deterministic and matches the Phase acceptance criteria.
- **Work:**
  - Ensure `package-lock.json` is present and up to date.
  - Update CI to use `npm ci` (not `npm install`).
- **Done when:** GitHub Actions runs `npm ci`, `npm run typecheck`, and `npm test` successfully on macOS/Windows/Linux.

## S012 — Remove deprecated Forge config file
- **Intent:** Avoid confusion and keep the repository honest about the canonical Forge configuration.
- **Work:**
  - Remove `forge.config.ts` (Forge is configured via `forge.config.js`).
- **Done when:** `forge.config.ts` is removed, OR (if removal is tool-blocked) it is clearly inert/unusable and the canonical Forge entrypoint is `forge.config.js`.

## S013 — Re-verify acceptance criteria after fixes
- **Intent:** The Phase cannot be approved without concrete evidence that the bootstrap runs as specified.
- **Work:**
  - Run locally:
    - `npm run typecheck`
    - `npm test`
    - `npm run build`
    - `npm run dev`
  - Confirm offline runtime after install:
    - Disable network and confirm `npm run dev` still launches and renders the UI shell.
  - Record results (commands + pass/fail + any notes) in `review.md`.
- **Done when:** Results are recorded and match the Phase acceptance criteria.

## S014 — Add unit test coverage for `createMainWindow` public API
- **Intent:** Satisfy L04 by ensuring every public method we wrote has unit tests that cover its conditional paths.
- **Work:**
  - Add a unit test for `createMainWindow()` that:
    - Mocks the `electron` module (do not assert Electron behavior, only our integration contract).
    - Asserts `BrowserWindow` is constructed with our expected options (including `webPreferences` coming from `createMainWindowWebPreferencesForForgeEnvironment()`).
    - Asserts we call `loadURL(MAIN_WINDOW_WEBPACK_ENTRY)`.
    - Asserts we register the `ready-to-show` handler.
  - Keep the test deterministic and focused on our code’s contract.
- **Done when:** `createMainWindow()` is covered by unit tests and all meaningful paths through it are exercised.

## S015 — Ensure `npm test` produces coverage output by default
- **Intent:** Make the test harness verifiably produce a coverage report as required by S006.
- **Work:**
  - Update the test configuration so running `npm test` produces coverage output (e.g., `jest --coverage` or `collectCoverage: true`).
  - Keep this cross-platform and deterministic.
- **Done when:** Running `npm test` produces coverage output locally and in CI.
