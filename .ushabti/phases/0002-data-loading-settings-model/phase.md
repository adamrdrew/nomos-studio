# Phase 0002 — Data Loading, Settings, and Data Model

## Intent
Introduce the first real “project configuration + document” loop for the editor:

- A Settings dialog that configures the external engine integration (Assets directory path + game executable path).
- A safe, globally accessible in-memory data model for the currently opened map JSON.
- A File-menu driven workflow to open → validate (via the game executable) → load → save a map JSON file.
- An in-memory index of the configured Assets directory, with a menu action to refresh it.

This Phase exists now because later editor features (rendering geometry, picking textures, spawning entities, launching/validating maps) depend on having reliable settings, a map document model, and deterministic file/process I/O.

## Scope

### In scope
- **Settings UI + persistence (minimal but real):**
  - Open a settings dialog from the application menu.
  - Configure:
    - **Assets directory path** (directory picker).
    - **Game executable path** (file picker).
  - Persist settings locally so they survive app restart.

- **Asset directory indexing:**
  - When an Assets directory is configured (or changed), build an in-memory index of files under it.
  - Add a File menu item to refresh the index on demand.
  - Display a success/failure message for refresh.

- **Map document lifecycle:**
  - From the File menu, open a native file dialog to select a `.json` map.
  - Gate opening on Settings:
    - If Assets directory or game executable is missing, display a friendly error and do not proceed.
  - Validation-first load pipeline:
    - Invoke the configured game executable with `--validate-map <mapPath>`.
    - Treat exit code `0` as valid.
    - Treat non-zero as invalid and show a GUI human-readable error.
    - If invalid, expect the process to output a JSON “error report”; parse and display it (fallback to raw output if parsing fails).
  - On successful validation, load the JSON file into the app’s central in-memory data model.
  - Save the currently loaded map back to disk as JSON.

- **Electron best practices for I/O:**
  - All OS dialogs, file I/O, and process execution happen in the main process.
  - Renderer interacts via a minimal, explicitly defined preload API surface.

- **Testing (L04/L08):**
  - Unit tests for public APIs introduced in this Phase, covering success/failure/edge cases and each conditional path.

### Out of scope
- Any map editing tools (drawing walls, sector creation, selection, undo/redo).
- Rendering map geometry or asset previews.
- Rich validation UX (inline error highlighting in an editor, clickable locations, etc.).
- Launching the game to play a map (except the validation subprocess invocation).
- Creating new maps from templates.

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - L01 (macOS/Windows/Linux parity): path handling, dialog behavior, and process invocation must be cross-platform.
  - L02 (offline local operation): no network is required for settings/index/load/save.
  - L03 (Electron security): renderer has no Node.js; privileged ops via preload IPC.
  - L04 (tests for public methods and conditional paths).
  - L06 (non-destructive by default): only read/write user-selected paths; saving is explicit.
  - L08 (design for testability): file system and process execution behind injectable adapters.
- Must follow `.ushabti/style.md` boundaries:
  - Domain/application/infrastructure split; isolate Electron primitives and side effects.
  - Avoid widening public API surface area.

## Acceptance criteria
- **Settings dialog**
  - A Settings dialog is reachable from the app’s menu (platform-idiomatic placement).
  - User can set:
    - Assets directory path (directory picker).
    - Game executable path (file picker).
  - Settings persist across app restart.

- **Gated load behavior**
  - If either Assets directory path or game executable path is missing, attempting to open a map results in a clear, human-readable GUI error and no validation subprocess is started.

- **Validation-first open flow**
  - File → Open Map… opens a native file dialog constrained to JSON.
  - After the user selects a JSON file:
    - The app runs `<gameExe> --validate-map <selectedMapPath>`.
    - The app uses an absolute `<selectedMapPath>` for reliability across working directories.
    - If exit code is `0`, the app loads and stores the map JSON as the active document.
    - If exit code is non-zero, the app displays a human-readable error and shows the JSON error report (pretty-printed) when available; if parsing fails, show the raw output.

- **Central data model**
  - The loaded map JSON is stored in a central app store and is accessible to the renderer in a safe way (via preload API and/or renderer store, without direct Node access).
  - The data model includes at least: document path, parsed JSON, and a “dirty”/modified flag (default false on load).

- **Save**
  - File → Save writes the current map JSON back to the originally opened file path.
  - Save is disabled (or shows a friendly error) when no map is loaded.
  - Save failures are surfaced as human-readable GUI errors.

- **Assets index**
  - When Assets directory is configured, an in-memory file index is built.
  - File → Refresh Assets Index triggers a rebuild.
  - User receives a clear GUI success/failure message after refresh.
  - The index is stored in the central store and includes enough metadata for later use (at minimum: relative path list + counts).

- **Tests**
  - Any new public methods added in this Phase have unit tests that cover all conditional paths:
    - missing settings gate
    - validation success / validation failure
    - invalid JSON report parsing (fallback)
    - file read failures
    - asset index success / failure
    - save success / failure

## Risks / notes
- **Assumption (validation contract):** the game executable writes the JSON error report to stdout/stderr on non-zero exit. If the engine prints human text instead, the UI must still show it.
- **Validated constraint (working directory):** `--validate-map` does not require awareness of the Assets directory structure; it accepts an absolute path or a path relative to the executable. The editor should prefer absolute map paths when invoking validation.
- **Map schema:** this Phase trusts the engine validator as the source of truth for conformance; the editor should still guard against malformed JSON / unexpected shapes to avoid crashes.
- Keep the preload API surface minimal; prefer one “workspace/settings + file/process operations” namespace rather than many channels.
