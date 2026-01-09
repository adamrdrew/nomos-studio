# Phase 0002 Steps — Data Loading, Settings, and Data Model

## S001 — Define settings + document domain models
- **Intent:** Make invalid states hard to represent and keep domain types independent of Electron.
- **Work:**
  - Define TypeScript types for:
    - `EditorSettings` (assetsDir, gameExePath).
    - `AssetIndex` (baseDir, entries, stats).
    - `MapDocument` (path, json value, dirty flag, lastValidatedAt/result).
  - Define typed error/result shapes for operations (load, validate, index, save).
- **Done when:** Domain model types exist and do not import Electron/FS/process modules.

## S002 — Implement settings persistence (infrastructure + application service)
- **Intent:** Settings survive restarts without leaking Electron primitives into domain.
- **Work:**
  - Implement a settings repository that reads/writes a JSON config under `app.getPath('userData')`.
  - Ensure writes are atomic (write temp + rename) and non-destructive.
  - Provide an application-layer service API (public) for `getSettings()` / `updateSettings()`.
- **Done when:** Settings can be loaded on startup and updated, with unit tests covering success/failure paths.

## S003 — Expose minimal preload IPC for privileged operations
- **Intent:** Keep renderer unprivileged while enabling platform-idiomatic dialogs and I/O.
- **Work:**
  - Add a minimal preload API surface for:
    - showing “select directory” dialog (Assets)
    - showing “select file” dialog (game executable)
    - showing “open map” dialog
    - validating a map via subprocess
    - reading/writing files needed for map open/save
    - refreshing asset index
  - Ensure IPC uses `invoke/handle` request-response patterns.
- **Done when:** Renderer has no Node access and can call these operations via typed preload APIs.

## S004 — Build Settings dialog UI
- **Intent:** Provide the user-facing entrypoint for configuring integration.
- **Work:**
  - Implement a Settings dialog UI in the renderer.
  - Include buttons to browse for Assets directory and game executable.
  - Display current values and validation feedback (e.g., “path not set”).
  - Save changes through the application/preload API.
- **Done when:** Settings dialog can set both paths and settings persist after restart.

## S005 — Create Asset index builder + store integration
- **Intent:** Produce an in-memory index of Assets for later features.
- **Work:**
  - Implement an indexer that recursively enumerates files under the Assets directory.
  - Store entries as relative paths (portable across machines), plus counts.
  - Update the central store when indexing succeeds; record errors when it fails.
- **Done when:** Index builds on settings change and is queryable from the store; unit tests cover success/failure.

## S006 — Add File menu actions (Open/Save/Refresh Index/Settings)
- **Intent:** Match the required UX entry points via platform-idiomatic menu.
- **Work:**
  - Wire menu items:
    - Settings…
    - Open Map…
    - Save
    - Refresh Assets Index
  - Ensure disabled/enabled states are sensible (e.g., Save disabled if no document).
- **Done when:** Menu items exist and trigger the intended operations end-to-end.

## S007 — Implement validation runner (subprocess adapter)
- **Intent:** Centralize and test subprocess invocation for `--validate-map`.
- **Work:**
  - Create a process-runner adapter (DI-friendly) that executes the configured game executable.
  - Capture exit code, stdout, stderr.
  - Normalize the map path to an absolute path before invoking `--validate-map`.
- **Done when:** A public `validateMap(mapPath)` API exists with unit tests for exit-code and output-handling branches.

## S008 — Implement open-map pipeline (gate → validate → load → store)
- **Intent:** Provide the core “open map” workflow.
- **Work:**
  - Gate on settings configured; show friendly error dialog if missing.
  - After file selection, validate first.
  - On validation success: read file and parse JSON into the `MapDocument` store.
  - On validation failure: parse JSON error report when possible and display it; fallback to raw output.
- **Done when:** Opening a valid map results in an active document; invalid maps show a readable error without loading.

## S009 — Implement save pipeline
- **Intent:** Allow users to persist modifications safely (even if no editor tools exist yet).
- **Work:**
  - Serialize current document JSON to pretty-printed JSON.
  - Write atomically to the opened map path.
  - Surface failures via GUI error.
- **Done when:** Save writes back to disk, with unit tests for success/failure.

## S010 — Central store wiring and selectors
- **Intent:** Ensure map/settings/index are accessible to the app predictably.
- **Work:**
  - Define store slices for settings, asset index, and map document.
  - Provide a minimal set of public selectors/actions; avoid wide exports.
- **Done when:** Renderer can read current settings/index/document state without privileged APIs.

## S011 — Unit tests for all public APIs and conditional paths
- **Intent:** Satisfy L04 and prevent regressions.
- **Work:**
  - Add unit tests covering:
    - settings persistence read/write failures
    - gate logic branches
    - validator success/failure + JSON report parse fallback
    - file read/write errors
    - indexer success/failure
- **Done when:** `npm test` passes and coverage includes all new public methods’ branches.

## S012 — Manual verification checklist update
- **Intent:** Make the Phase’s UX verifiable by a human reviewer.
- **Work:**
  - Record a short checklist for:
    - setting paths
    - refreshing index
    - opening/validating a valid map
    - seeing an error on invalid map
    - saving
- **Done when:** A checklist exists that a reviewer can follow to confirm acceptance criteria.

## S013 — Fill L04 test gaps for public APIs and remaining conditional branches
- **Intent:** Comply with L04 (public methods + all conditional paths).
- **Work:**
  - Add unit tests for `AppStore` public methods:
    - `getState`, `subscribe` (including unsubscribe), `setSettings`, `setAssetIndex`, `setAssetIndexError`, `setMapDocument`.
  - Add unit tests for public Node adapters focusing on our integration contracts (not Node internals):
    - `nodeProcessRunner.run` (mock `spawn`; assert stdout/stderr aggregation and exit-code propagation).
    - `nodeDirectoryReader.readDir` (mock `fs.readdir`; assert mapping to `{name,isDirectory}` entries).
    - `nodeFileSystem` wrapper functions (mock `fs/promises`; assert correct forwarding of args/encodings).
  - Cover remaining conditional branches in public services:
    - `SaveMapService.saveCurrentDocument` rename fallback branch.
    - `OpenMapService.openMap` missing-settings message branches.
    - `MapValidationService.validateMap` stderr-selection branch and empty-output branch.
- **Done when:** Added tests cover all conditional paths for the above public methods and pass under `npm test`.

## S014 — Make unit tests cross-platform (Windows-safe paths)
- **Intent:** Comply with L01 enforcement by ensuring unit tests run correctly on Windows/macOS/Linux.
- **Work:**
  - Update tests (especially `AssetIndexer.test.ts`) to avoid hard-coded POSIX absolute paths; build paths using `node:path` helpers and avoid assuming `/` separators in directory-reader keys.
- **Done when:** Tests do not assume POSIX absolute paths and are expected to pass unchanged on Windows/macOS/Linux.

## S015 — Ensure deterministic temp-file cleanup and safe replace semantics (L05/L06)
- **Intent:** Comply with L05 (no temp-file leaks) and reduce data-loss risk during explicit saves (L06).
- **Work:**
  - In `SaveMapService.saveCurrentDocument`:
    - Ensure `${filePath}.tmp` is deleted on any failure after it is created.
    - Ensure the “Windows-style rename fallback” does not permanently delete the destination unless the replacement is guaranteed (e.g., use a backup/restore strategy or ensure cleanup + clear error semantics).
  - In `JsonFileSettingsRepository.saveSettings`:
    - Ensure `${settingsFilePath}.tmp` is deleted on any failure after it is created.
    - Apply the same safe-replace semantics as above.
  - Add/extend unit tests to cover cleanup behavior (e.g., verify `unlink(tmpPath)` is attempted when rename fails with an unhandled code, and that the destination is not lost on retry failure).
- **Done when:** No error path can leave `*.tmp` files behind and save failures do not introduce avoidable data loss; `npm run typecheck` and `npm test --coverage` remain green.

## S016 — Close remaining L04 branch gaps in safe-replace helpers (backup collisions + cleanup failures)
- **Intent:** Ensure S015’s safe-replace logic fully complies with L04 by testing all conditional paths exercised by public save APIs.
- **Work:**
  - Extend `SaveMapService.saveCurrentDocument` tests to cover:
    - Backup-path collision handling: moving destination to `${file}.bak` fails with `EEXIST`, then succeeds with `${file}.bak.1`.
    - Backup cleanup failure: `unlink(backupPath)` throws but save still returns `ok: true`.
    - Backup-path exhaustion: all 10 backup candidates fail with `EEXIST`, the save returns `map-io/write-failed`, and `${file}.tmp` is cleaned up.
  - Extend `JsonFileSettingsRepository.saveSettings` tests to cover the same three cases.
- **Done when:** `npm test --coverage` no longer reports uncovered lines for the safe-replace branches in:
  - `SaveMapService.ts` (backup collision loop + backup unlink best-effort)
  - `JsonFileSettingsRepository.ts` (same)
  and the tests exercise these behaviors through the public methods (no direct tests of private helpers).
