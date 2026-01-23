# Steps — Phase 0031 Fresh Launch Experience

## S001 — Define routing rule for Fresh Launch
- **Intent:** Make startup behavior deterministic and easy to reason about.
- **Work:**
  - Define the renderer routing condition: Fresh Launch is shown when not in settings mode and `mapDocument === null` in the latest snapshot.
  - Identify where snapshot refresh/subscription should live so both Fresh Launch and Editor Shell stay in sync with main (`nomos:state:changed`).
- **Done when:** A clear routing approach is recorded and referenced by later steps.

## S002 — Build Fresh Launch renderer view
- **Intent:** Provide a dedicated first-run/first-open UI surface.
- **Work:**
  - Add a renderer component (e.g., `FreshLaunchView`) that renders:
    - “Nomos Studio” in the upper-left.
    - Two prominent tiles/buttons: Create New, Open Existing.
    - A recent maps list section below.
  - Add styling (Blueprint + minimal CSS) consistent with existing renderer surfaces.
- **Done when:** The view can render from mocked state and meets the described layout.

## S003 — Promote recent maps into main `AppStore`
- **Intent:** Ensure the menu and renderer share a single, consistent recent-maps source.
- **Work:**
  - Add `recentMapPaths: readonly string[]` to `AppStore` state with a narrow setter.
  - Update main startup to load recents via `RecentMapsService.load()` and store them in `AppStore`.
  - Update open-map success paths (open/open-from-assets) to bump recents and write the updated list to `AppStore`.
  - Decide whether “Create New” should also bump recents (recommended: yes, since it produces a path-backed document).
- **Done when:** File menu recents are driven from `AppStore` and still behave as before.

## S004 — Extend state snapshot to include recent maps
- **Intent:** Allow the renderer to display recent maps without adding ad-hoc global state.
- **Work:**
  - Extend `AppStateSnapshot` in `src/shared/ipc/nomosIpc.ts` to include `recentMapPaths`.
  - Update main snapshot handler to populate it from `AppStore`.
  - Update renderer store refresh logic to store and expose `recentMapPaths`.
- **Done when:** Renderer can read `recentMapPaths` from the snapshot and the IPC contract remains typed.

## S005 — Add a minimal IPC entrypoint for “Create New”
- **Intent:** Let the renderer open a Save dialog and create a new path-backed document while preserving L03 boundaries.
- **Work:**
  - Add a typed IPC channel + preload wrapper for a “new map” workflow.
  - Prefer an application-level workflow/service with injected dialog adapter (L08) so branches are unit testable.
  - Behavior must match File → New Map semantics: prompt for save path (JSON), cancel is no-op, success creates a new `MapDocument` with `dirty: true`.
- **Done when:** Renderer can invoke “Create New” through `window.nomos.*` without Node access and with unit tests covering cancel/success/error.

## S006 — Wire Fresh Launch actions
- **Intent:** Connect UI affordances to existing open/new map flows.
- **Work:**
  - **Create New** tile: call the new IPC entrypoint; on success, rely on state refresh to transition to editor.
  - **Open Existing** tile: use the existing open-map dialog IPC and then `window.nomos.map.open({ mapPath })`.
  - **Recent map** click: call `window.nomos.map.open({ mapPath })` for that entry.
  - Ensure error cases show user-visible feedback consistent with existing patterns (via main notifier paths).
- **Done when:** Each action works end-to-end and results in editor shell rendering when a document exists.

## S007 — Missing configuration warning
- **Intent:** Make configuration prerequisites obvious before users hit failures.
- **Work:**
  - In Fresh Launch view, compute `isConfigured` from snapshot settings.
  - When not configured, render a red warning line above the tiles with clear guidance to open Settings (include `CommandOrControl+,`).
- **Done when:** Warning reliably appears/disappears as settings change.

## S008 — Update/extend unit tests (L04)
- **Intent:** Keep public APIs and branchy paths protected.
- **Work:**
  - Add/update tests for:
    - `AppStore` recent-maps field + setter behavior.
    - Any new application service/workflow created for “Create New”, covering cancel/success/error branches.
    - IPC handler registration / wiring if new channels are introduced.
  - Keep tests focused on our code and integration contracts, not Electron internals.
- **Done when:** `npm test -- --runInBand` passes and coverage includes new branch paths.

## S009 — Update subsystem docs (L09)
- **Intent:** Keep architecture documentation aligned with reality.
- **Work:**
  - Update docs to reflect:
    - new startup routing / Fresh Launch view (renderer UI doc)
    - recent maps now available in store + snapshot (store/menu docs)
    - any new IPC channel/preload surface (IPC doc)
- **Done when:** Docs under `docs/` describe the new behavior and public surfaces accurately.

## S010 — Verification pass
- **Intent:** Ensure quality gates and core workflows are intact.
- **Work:**
  - Run: lint, typecheck, jest.
  - Manually verify:
    - startup shows Fresh Launch when no map is open
    - menu open/new still works
    - recent maps list matches menu
    - missing-config warning appears when appropriate
- **Done when:** All checks are green and the UX matches acceptance criteria.

## S011 — Add unit tests for new preload API surface (L04)
- **Intent:** Ensure newly added renderer-facing public API methods are covered by unit tests per L04.
- **Work:**
  - Add a unit test that verifies the new preload wrapper `window.nomos.map.new()` invokes the correct typed IPC channel (`nomos:map:new`) and returns the typed response.
  - Introduce a small test seam if needed (e.g., export a factory that builds the `window.nomos` API from an `ipcRenderer`-like adapter), keeping the preload surface narrow.
- **Done when:** A Jest test covers the new preload method and passes.
