# Phase 0019 Steps — File Menu + File Handling Enhancements

## S001 — Inspect current file workflows and state owners
- **Intent:** Anchor work to existing menu/map/services architecture and avoid regressions.
- **Work:**
  - Confirm where File menu items are wired in `src/main/main.ts` (Open Map, Save).
  - Confirm how map dirty state (`MapDocument.dirty`) is set/cleared and how save is performed.
  - Confirm how undo/redo history is cleared today (it is cleared on map open) and identify the right “clear history on close/new” hook.
  - Confirm Asset Browser current double-click behavior and its `window.nomos.assets.open(...)` usage.
- **Done when:** Notes exist listing the exact main entrypoints and services to extend.

## S002 — Define a testable unsaved-changes guard (core orchestration)
- **Intent:** Centralize Save/Don’t Save/Cancel logic so all file actions behave consistently.
- **Work:**
  - Introduce a small application-layer orchestrator (e.g., `UnsavedChangesGuard` or `MapCloseGuard`) that:
    - inspects `store.getState().mapDocument` and `.dirty`
    - prompts the user when needed
    - delegates to `SaveMapService` when Save is chosen
    - returns an explicit decision/result: proceed vs abort
  - Add an injectable prompting interface (e.g., `UserPrompter.confirmUnsavedChanges(...)`) so the guard is unit-testable without Electron.
- **Done when:** A single public API exists to wrap guarded actions and it is dependency-injected.

## S003 — Unit tests for the guard (L04)
- **Intent:** Prove all branches of the guard are correct and non-destructive by default.
- **Work:**
  - Add tests covering:
    - no document → proceeds
    - not dirty → proceeds
    - dirty + Cancel → aborts
    - dirty + Don’t Save → proceeds without calling save
    - dirty + Save + save ok → proceeds
    - dirty + Save + save fails → aborts and notifies
- **Done when:** Guard public methods have branch-complete tests.

## S004 — Implement New Map command (menu + state reset)
- **Intent:** Provide a reliable “blank slate” and ensure history/selection do not leak.
- **Work:**
  - Add **New Map** item to the File menu template and wire to main callback.
  - In main, implement `newMap()` using the unsaved-changes guard.
  - Clear:
    - `AppStore.mapDocument` (set to `null`)
    - main-owned undo/redo history (add an explicit clear/reset hook if missing)
  - Ensure renderer selection clears when `mapDocument` becomes `null`.
- **Done when:** New Map behaves per acceptance criteria and Undo/Redo becomes disabled.

## S005 — Implement Save As… (dialog + save-to-new-path)
- **Intent:** Support idiomatic “save under new name/location” flows.
- **Work:**
  - Add **Save As…** item to the File menu template and wire to main callback.
  - Add a dialog path in main to select destination (Electron save dialog), including:
    - default directory/name from current `mapDocument.filePath`
    - JSON filter
  - Extend save logic to support “save current document to explicit path”, updating:
    - `MapDocument.filePath`
    - `dirty: false` on success
  - Decide and record overwrite behavior (use OS dialog’s overwrite confirmation).
- **Done when:** Save As writes to a new path and updates in-memory document path.

## S006 — Unit tests for Save As and save-to-path logic (L04)
- **Intent:** Keep file operations safe and branch-covered.
- **Work:**
  - Add unit tests for any new/changed public save APIs:
    - no document → error
    - save-to-path success updates filePath + dirty
    - write failure → typed error and notification
  - If the save dialog is wrapped in an injected adapter, unit test cancel vs chosen path behavior at the orchestrator layer.
- **Done when:** Public save-related methods introduced/changed are fully branch-tested.

## S007 — Implement guarded Open Map… and persistent Recent Maps
- **Intent:** Prevent data loss when switching documents.
- **Work:**
  - Update File → Open Map… path to use the unsaved-changes guard before actually opening.
  - Add a Recent Maps list (max 5, deduped) updated after successful open.
  - Persist Recent Maps across restarts via a small main-process repository that reads/writes `recent-maps.json` under Electron `app.getPath('userData')`, behind the existing `FileSystem` adapter.
    - Missing file => empty list.
    - Invalid/unparseable JSON => empty list (and do not crash the app).
  - Load persisted Recent Maps on startup and keep the in-memory list consistent with the persisted store.
  - Add File → Recent Maps submenu:
    - shows last 5 paths (most recent first)
    - selecting opens via the same guarded open path
  - Add/extend menu template tests to verify:
    - Recent Maps submenu presence
    - menu items reflect provided recent list
- **Done when:** Open Map… and Recent Maps open both guard unsaved changes and the menu renders correctly.

## S008 — Asset Browser: extensible double-click action router (maps first)
- **Intent:** Make in-app navigation work like an editor, not a file explorer.
- **Work:**
  - In renderer Asset Browser, detect double-click on entries.
  - Introduce a small “asset action router” abstraction that chooses an action based on the clicked asset’s relative path.
    - Initial rule: if entry is a map asset (`Levels/` prefix + `.json` extension), request opening it in-editor.
    - Default rule: open via the existing OS handler (`window.nomos.assets.open({ relativePath })`).
  - Add a minimal IPC/preload method (e.g., `window.nomos.map.openFromAssets({ relativePath })`) that resolves the relative path against `settings.assetsDirPath` in main (with path safety checks) and opens the map.
  - Route the open through the same unsaved-changes guard.
- **Done when:** Double-clicking `Levels/...json` loads the map; other assets open externally; the routing system is easy to extend.

## S009 — Unit tests for open-from-assets and recent persistence (L04)
- **Intent:** Keep new IPC/service behavior safe and deterministic.
- **Work:**
  - Add tests for new main/public APIs:
    - open-from-assets rejects missing assetsDirPath
    - open-from-assets rejects traversal/out-of-root relative paths
    - open-from-assets success delegates to existing open flow and updates recents
    - recents dedupe and cap-5 behavior
    - recents repository load/save behavior:
      - missing `recent-maps.json` => empty list
      - empty list file => empty list
      - invalid/corrupt JSON => empty list
  - Extend IPC wiring tests if a new channel is added.
- **Done when:** New IPC and orchestration paths are branch-covered.

## S010 — Quit/close guard for unsaved changes
- **Intent:** Prevent accidental data loss on app exit.
- **Work:**
  - Add a main-process quit/close interception that:
    - checks for dirty document
    - shows Save/Don’t Save/Cancel prompt
    - Save → attempts save then proceeds to quit
    - Cancel → abort quit
  - Implement with a re-entrancy-safe approach (avoid infinite quit loops).
  - Keep the core decision logic testable behind injected interfaces.
- **Done when:** App quit/close shows the prompt and respects user choice.

## S011 — Docs updates (L09) + quality gates
- **Intent:** Keep subsystem documentation truthful and ship green.
- **Work:**
  - Update docs:
    - `docs/menu-system.md` (New Map, Save As…, Recent Maps)
    - `docs/maps-system.md` (guarded open semantics, Save As behavior)
    - `docs/assets-system.md` and/or `docs/renderer-ui-system.md` (asset browser map-open behavior)
    - `docs/ipc-system.md` (any new IPC channel)
    - `docs/app-store-system.md` if new main state is added
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual verification checklist:
    - New Map resets state/history
    - Save As… writes and updates current path
    - Guard prompt appears for Open/New/Recent/Asset double-click/Quit
    - Recent Maps shows last 5 and opens correctly
- **Done when:** Docs updated and all quality gates pass.
