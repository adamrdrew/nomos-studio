# Phase 0003 Steps — Settings Management System

## S001 — Confirm current settings contract and define the versioned on-disk format
- **Intent:** Make the settings persistence format explicit and extensible without expanding scope.
- **Work:**
  - Identify the current settings file location and shape.
  - Define the new versioned format (e.g., `version: 1` plus a clearly named object for editor settings), including how unknown keys are preserved.
  - Define backward-compatibility behavior for legacy/unversioned files.
- **Done when:** A concrete format and compatibility rules are documented (in code comments or a short doc near the repository) and reflected in implementation tasks.

## S002 — Implement settings codec (decode/encode) with versioning + unknown-field preservation
- **Intent:** Centralize parsing/serialization so adding future settings is safe and predictable.
- **Work:**
  - Introduce a dedicated codec/serializer module responsible for:
    - decoding unknown JSON → typed settings + preserved unknown fields
    - encoding typed settings + preserved unknown fields → JSON object
    - handling legacy/unversioned files
  - Ensure codec has no Electron dependencies.
- **Done when:** Public codec functions exist with unit tests for:
  - legacy file decode
  - versioned file decode
  - invalid JSON/object decode failure
  - encode preserves unknown keys

## S003 — Integrate codec into settings repository and update write path safety
- **Intent:** Ensure persistence uses the codec and remains safe/atomic and non-destructive.
- **Work:**
  - Update the settings repository to use the codec.
  - Ensure settings updates:
    - write atomically
    - do not leak `*.tmp`
    - do not drop unknown fields
- **Done when:** Repository load/save behavior meets acceptance criteria and unit tests cover success/failure/branch paths.

## S004 — Make Settings/Preferences menu entrypoints platform-idiomatic
- **Intent:** Provide the expected Settings entrypoint per OS.
- **Work:**
  - macOS:
    - Use an app-menu (menu bar) entry that matches platform conventions (label "Preferences…" and Cmd+,; prefer the Electron role when appropriate for correct placement).
  - Windows/Linux:
    - Provide a Settings entry (e.g., under Edit) with a conventional accelerator.
  - Keep behavior consistent: menu action opens the Settings UI.
- **Done when:** Menu templates implement the OS-specific conventions and tests validate our menu template/contract (without testing Electron internals).

## S004a — Ensure renderer CSP allows dev builds to execute (without weakening production)
- **Intent:** Prevent blank windows in dev caused by an overly-strict CSP blocking Webpack dev tooling.
- **Work:**
  - Make the renderer `Content-Security-Policy` environment-aware:
    - In development: allow Webpack dev tooling (e.g., `'unsafe-eval'` and `connect-src` for devserver websockets).
    - In production: keep CSP strict (no `'unsafe-eval'`).
- **Done when:** In `npm run dev`, renderer code executes (main window content renders), and the Settings UI can be verified.

## S004b — Remove temporary debug/event bridge code from Settings troubleshooting
- **Intent:** Tighten the preload API surface (L03) and eliminate dead code introduced during debugging.
- **Work:**
  - Remove the `uiOpenSettings` event and `waitForOpenSettings` preload event API.
  - Remove the dev-only debug IPC logging channel used only for troubleshooting.
  - Remove any now-unused shared helpers introduced for this path.
- **Done when:** App still runs in `npm run dev` and Settings opens via the menu without relying on the removed event APIs.

## S004c — Remove retired AsyncSignal files (no empty test suites)
- **Intent:** Avoid dead/misleading files and ensure Jest remains green.
- **Work:**
  - Remove the retired AsyncSignal artifacts from the codebase.
  - If file deletion is not feasible in the current tooling environment, restore the AsyncSignal implementation and its unit tests so Jest remains green and no empty test suites exist.
  - Confirm `npm test` and `npm run typecheck` are green.
- **Done when:** Either:
  - the AsyncSignal artifacts are removed from the repo, **or**
  - AsyncSignal remains as a real, tested utility (no empty test suites),
  and `npm test` and `npm run typecheck` are green.

## S005 — Verify renderer Settings UI continues to manage the two current settings
- **Intent:** Ensure the Settings UI still reads/writes the two settings through the preload IPC boundary.
- **Work:**
  - Confirm the Settings UI reads settings on open and writes updates on Save.
  - Confirm updates persist across restart.
  - Confirm unknown-field preservation is not broken by UI update flow.
  - Confirm Settings is not exposed via any new main-window UI control; the menu entrypoint is the only required UX.
- **Done when:** Manual verification demonstrates:
  - editing each setting persists
  - unknown keys in the settings file survive an update

## S006 — Add/extend unit tests for conditional paths and compatibility
- **Intent:** Satisfy L04 for any new/changed public methods and prevent regressions.
- **Work:**
  - Add tests for settings migration/compatibility branches.
  - Add tests for menu entrypoint construction branches (darwin vs non-darwin).
- **Done when:** `npm test` and `npm run typecheck` are green and coverage includes all new public methods’ branches.

## S007 — Manual verification checklist for Settings management
- **Intent:** Make Phase acceptance criteria human-verifiable.
- **Work:**
  - Document a short checklist covering:
    - opening Settings via menu on macOS and Windows/Linux
    - saving and persistence across restart
    - unknown-key preservation scenario
- **Done when:** A checklist exists in the Phase directory and can be followed by a reviewer.
