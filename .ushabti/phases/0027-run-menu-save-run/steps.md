# Steps — Phase 0027 (Run Menu: Save & Run)

## S001 — Confirm run invocation contract
- **Intent:** Remove ambiguity about how the engine should be invoked.
- **Work:**
  - Record the agreed invocation format: `./game_executable <mapFileName.json>`.
  - Record that the engine resolves levels under `Assets/Levels` internally and Save & Run does not need to set `cwd`.
  - Record that Save & Run will pass the current map filename even if it was opened outside `Assets/Levels`.
- **Done when:** A single agreed contract is recorded (either in this Phase notes or in subsystem docs) and informs subsequent implementation steps.

## S002 — Extend menu template options and tests
- **Intent:** Add the Run menu in a platform-consistent, testable manner.
- **Work:**
  - Update `createApplicationMenuTemplate` options shape to accept `onSaveAndRun` (and any enablement state if distinct from `canSave`).
  - Insert a new top-level **Run** menu with a single **Save & Run** item using accelerator `F5`.
  - Add/adjust unit tests for menu template to assert presence, label, and accelerator.
- **Done when:** Menu template tests pass and demonstrate correct platform behavior.

## S003 — Add main-process wiring for Save & Run
- **Intent:** Connect the menu item to main-process orchestration without expanding renderer privileges.
- **Work:**
  - In main composition/root (`src/main/main.ts`), wire `onSaveAndRun` to a single application-layer entrypoint (service method) rather than inlining multi-step logic in the menu callback.
  - Ensure menu rebuild logic includes any enablement state required.
- **Done when:** The menu callback is wired to a single well-named application method and can be exercised via tests.

## S004 — Implement application-layer orchestration service
- **Intent:** Provide a cohesive, testable public API for Save → Validate → Run.
- **Work:**
  - Introduce an application service (e.g., `RunMapService` or `SaveAndRunMapService`) with a single public method (e.g., `saveAndRunCurrentMap()`), injected with:
    - `AppStore`
    - `SaveMapService`
    - `MapValidationService`
    - `ProcessRunner`
    - `UserNotifier`
    - time/path helpers as needed
  - Orchestration order:
    1. Verify there is a current map document; if missing, no-op or notify user (decide and document).
    2. Save the current document.
    3. Validate the saved map by absolute file path.
    4. If validation fails, show error with report detail (reuse existing patterns).
    5. If validation succeeds, run engine executable using the agreed invocation contract.
  - Ensure failures are handled deterministically and do not attempt later steps.
- **Done when:** The service exists, has a stable public method name, and is fully unit-tested for all branches.

## S005 — Process runner support (if required)
- **Intent:** Support the run contract without shell execution while remaining cross-platform and testable.
- **Work (conditional):**
  - No changes expected.
  - Only if a real engine limitation is discovered later, extend `ProcessRunRequest` to include `cwd?: string` (and add tests) rather than introducing shell execution.
- **Done when:** Process runner tests pass and the new fields are optional and backwards-compatible.

## S006 — Validation report UX parity
- **Intent:** Ensure Save & Run uses the same validation failure UX as existing flows.
- **Work:**
  - Reuse the same `UserNotifier.showError` title/message conventions used for invalid maps (e.g., `Map validation failed`) and include `report.prettyText` as dialog detail.
  - Confirm the orchestration does not regress existing open/validate flows.
- **Done when:** Unit tests (and/or updated service tests) assert the correct notifier calls for validation failure.

## S007 — Documentation updates
- **Intent:** Keep subsystem docs accurate (L09).
- **Work:**
  - Update `docs/menu-system.md` to include the Run menu, accelerator, and wiring.
  - Update `docs/process-system.md` (and/or `docs/maps-system.md`) to describe the new run invocation and how it reuses `ProcessRunner` and `gameExecutablePath`.
- **Done when:** Docs clearly describe the new workflow and align with implementation.

## S008 — Full verification gates
- **Intent:** Ensure codebase remains green.
- **Work:**
  - Run `npm test -- --runInBand`.
  - Run `npm run typecheck`.
  - Run `npm run lint`.
- **Done when:** All tasks succeed.
