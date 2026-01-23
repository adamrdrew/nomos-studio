# Phase 0027 — Run Menu (Save & Run)

## Intent
Add a new **Run** menu with a **Save & Run** command (accelerator: **F5**) that saves the current map, validates it using the existing validator integration, and if valid launches the configured game/engine executable to run the map.

This Phase exists now because it connects the existing map-edit/save/validate workflows into a single fast iteration loop (save → validate → run) without widening renderer privileges.

## Scope

### In scope
- Add a new top-level **Run** menu on macOS and the appropriate equivalent on Windows/Linux using the existing menu template factory.
- Add **Save & Run** menu item:
  - accelerator: `F5`
  - enabled only when a map document is currently open (same enablement basis as Save).
- Implement main-process orchestration for Save & Run:
  1. Save current map document.
  2. Validate the saved map using existing `MapValidationService`.
  3. If validation fails: display validation report using the same notifier behavior used today for invalid maps.
  4. If validation succeeds: spawn the configured engine executable with arguments matching the required invocation format.
- Use the existing `EditorSettings.gameExecutablePath` (already used for validation) as the engine executable path.
- Map selection rules for run:
  - use the **current open map document** as the target.
  - pass the map **filename only** (no directory) as the single argument to the executable.
- Unit tests for any new/changed public methods and menu template changes.
- Update subsystem docs impacted by this change.

### Out of scope
- Adding a new Settings field for a separate “run executable” path.
- UI/renderer changes for running (no new renderer buttons/shortcuts beyond menu accelerator).
- Streaming engine output to UI, log windows, or a terminal panel.
- Multi-map run configurations, arguments editing UI, or selecting different run targets.
- Packaging/shipping the engine executable.

## Constraints
- **L01 Desktop Cross-Platform Parity:** Menu and execution behavior must work on macOS/Windows/Linux (platform differences must be contained in the menu-template abstraction, not scattered).
- **L03 Electron Security:** No renderer-side process execution; Save & Run stays main-process-only via existing wiring.
- **L06 System Safety:** No shell execution; run the configured executable only, with explicit args. Avoid introducing any general “execute arbitrary command” IPC.
- **L04 Testing Policy:** New public APIs must have unit tests covering conditional paths.
- **L08 Design for Testability:** Process spawning and time/paths must remain behind injectable seams.
- **L09 Documentation:** Update affected subsystem docs under `docs/`.

## Acceptance criteria
- Menu:
  - A top-level **Run** menu exists.
  - It contains an item **Save & Run** with accelerator `F5`.
  - **Save & Run** is disabled when no map is open.
- Behavior:
  - Triggering **Save & Run** with an open map performs save → validate → run in that order.
  - If save fails: no validation or run is attempted (and existing save failure UX remains intact).
  - If validation fails:
    - the user sees the same validation error title/message and report detail formatting currently used when invalid maps are encountered elsewhere.
    - the engine is not executed.
  - If validation succeeds:
    - the engine is executed via `ProcessRunner.run` with `command = settings.gameExecutablePath`.
    - the command line includes `<current_map_filename.json>` (filename only) as the single argument.
- Tests:
  - Menu template tests assert **Run → Save & Run** exists and has `F5` accelerator.
  - Orchestration unit tests cover:
    - no open document
    - missing/blank `gameExecutablePath`
    - save failure
    - validation failure (ensures run is not attempted and report is shown)
    - validation success triggers `ProcessRunner.run` with the expected arguments.
- Docs:
  - `docs/menu-system.md` describes the new Run menu and its wiring/enablement.
  - `docs/process-system.md` and/or `docs/maps-system.md` reflect the new run invocation flow and how it reuses the process runner.

## Assumptions
- The configured `gameExecutablePath` supports both:
  - validation via `--validate-map <absoluteMapPath>` (existing), and
  - running a map via an invocation equivalent to: `./engine_executable <filename>`.
- The engine resolves levels relative to `Assets/Levels` internally, so Save & Run does not need to set a working directory.
- Save & Run passes only the current map filename even if the map was opened from outside `Assets/Levels`; any resulting engine failure is considered a user/project configuration issue.

## Risks / notes
- **Maps opened outside Assets:** Save & Run uses filename-only invocation, which may not work if the project’s assets/levels layout is misconfigured. This is intentionally pushed to project setup rather than handled in-app.
