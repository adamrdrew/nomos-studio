# Phase 0041 — JSON Editor

## Intent
Add an in-app JSON editor with Monaco (VS Code editor) so that double-clicking JSON assets opens them inside Nomos Studio (not an external editor), with multiple scrollable tabs, correct dirty-state indication, and menu Save/Save & Run routing.

This Phase exists now because the asset browser already routes double-clicks to either map-open or OS-open; extending that to an internal JSON editor completes the in-app editing loop and unblocks workflows that require editing non-map JSON assets.

## Scope

### In scope
- Asset Browser double-click behavior changes:
  - Double-clicking any `*.json` asset no longer opens via OS default handler.
  - Double-clicking `Levels/*.json` continues to open the map in the Map Editor (existing behavior).
  - Double-clicking any other `*.json` opens that file in a new **JSON editor tab**.

- Editor tab system (renderer):
  - A tab bar exists in the main editor surface with a non-closable **Map** tab and 0..N closable **JSON** tabs.
  - Tab bar scrolls horizontally when there are too many tabs.
  - JSON tabs have an **X icon on the left side** that closes the tab.
  - Tabs are not re-orderable.
  - Tabs cannot be popped out into a new window.
  - Tab titles are the **file name** (basename).
  - Tab title label color indicates dirty state:
    - **Red** when the editor content has unsaved changes.
    - **White** when the editor content matches the last saved state.
  - The Map tab title uses the same red/white dirty indication, derived from `mapDocument.dirty`.

- Monaco-based JSON editor:
  - Uses the Monaco editor (the editor VS Code uses).
  - Uses a dark theme.
  - JSON language mode with syntax highlighting.
  - Shows diagnostics when JSON is malformed (Monaco markers / inline squiggles).

- Menu command routing:
  - **Save** routes to the *currently active editor tab*:
    - Map tab → saves the current map (existing save behavior).
    - JSON tab → saves that JSON file.
  - **Save & Run** saves **all open editors** (map + all open JSON tabs), then performs the existing Save & Run behavior.

- Main/preload support for text asset I/O (JSON):
  - Add a typed, traversal-safe IPC/preload method to read a UTF-8 text asset from `assetsDirPath` by relative path.
  - Add a typed, traversal-safe IPC/preload method to write a UTF-8 text asset back to `assetsDirPath` by relative path using a safe-write strategy.
  - Restrict this feature to `*.json` (narrow capability) unless the user explicitly expands scope later.

- Tests and docs updates required by laws.

### Out of scope
- JSON schema-aware features (schema selection, auto-complete from schema, schema-based validation beyond basic JSON parse diagnostics).
- JSON formatting commands (prettify/minify) and custom keybindings.
- “Save As…” for JSON tabs.
- Reordering tabs, pinning tabs, splitting editors, or multi-window popouts.
- Editing maps as raw JSON (i.e., opening `Levels/*.json` in the JSON editor instead of Map Editor).
- Persisting the list of open JSON tabs across app restarts.

## Constraints
- **L01 Desktop Cross-Platform Parity:** Must work on macOS/Windows/Linux; file path handling uses relative paths with POSIX normalization already established in the assets system.
- **L03 Electron Security:** Renderer remains unprivileged; JSON read/write must go through typed preload/IPC (no Node APIs in renderer).
- **L06 System Safety:** Text read/write must be restricted to the configured assets directory with traversal protection; no arbitrary filesystem access.
- **L05 Resource Safety:** Opening/closing many JSON tabs must not leak resources (dispose Monaco models and event listeners on close).
- **L04 Testing Policy:** New/changed public methods and IPC wiring must have unit tests covering conditional paths.
- **L08 Design for Testability:** File I/O and path resolution remain behind injectable adapters/services; UI logic keeps seams for deterministic tests where feasible.
- **L09 Documentation:** Update relevant subsystem docs under `docs/`, and add a new subsystem doc if this introduces a distinct “JSON editor / editor tabs” subsystem.

Style constraints (see `.ushabti/style.md`):
- Keep boundaries explicit (renderer UI vs main application services vs infrastructure adapters).
- Avoid widening APIs; prefer narrow, typed IPC operations.

## Acceptance criteria
- Asset browser:
  - Double-clicking a `*.json` file does not open the OS external editor.
  - Double-clicking `Levels/*.json` opens the map in the Map Editor as before.
  - Double-clicking any other `*.json` opens a JSON editor tab.

- Tabs:
  - A Map tab is always present and cannot be closed.
  - Opening multiple JSON files results in multiple sibling tabs.
  - The tab strip scrolls horizontally when tabs overflow.
  - JSON tabs show a left-side X button; clicking it closes the tab.
  - Tab titles display the file basename.
  - Dirty state coloring:
    - Unsaved JSON tab title text is red.
    - Saved JSON tab title text is white.
    - Map tab title text is red when `mapDocument.dirty === true`, otherwise white.

- JSON editor:
  - Uses Monaco.
  - Dark theme is active.
  - JSON syntax highlighting is visible.
  - Malformed JSON produces visible diagnostics (markers/squiggles and/or gutter marker).

- Save routing:
  - With a JSON tab focused, choosing File → Save writes that JSON file and clears its dirty indicator.
  - With the Map tab focused, choosing File → Save saves the map and clears the map dirty indicator.
  - Choosing Run → Save & Run saves all dirty JSON tabs and the map (if dirty) before validating/running.

- Safety:
  - JSON read/write IPC rejects:
    - missing `assetsDirPath`
    - empty/whitespace relative paths
    - absolute paths
    - traversal outside the assets directory
    - non-`.json` paths (unless explicitly broadened later)

- Tests:
  - Unit tests cover new main-process services and IPC handlers (success + each failure branch listed above).
  - Menu template tests remain green and cover Save/Save & Run wiring changes.

- Docs:
  - `docs/assets-system.md`, `docs/menu-system.md`, and `docs/renderer-ui-system.md` are updated to reflect the new JSON editor behavior and save routing.
  - A new `docs/json-editor-system.md` (or equivalent) exists if the JSON editor constitutes a new subsystem.

## Assumptions
- `Levels/*.json` files are primarily edited through the Map Editor; raw JSON editing for level files is intentionally deferred.
- JSON files are UTF-8 text.
- The existing safe-write strategy used by map save can be reused for JSON text saves (or an equivalent, similarly safe approach).

## Risks / notes
- Monaco in Electron/Webpack often requires worker bundling and CSP consideration; ensure the chosen integration works within the existing Forge/Webpack pipeline and security posture.
- Save & Run becomes dependent on saving potentially many open JSON tabs; implement a deterministic “save all” order and failure handling (e.g., stop on first failure vs best-effort) and document the chosen behavior.
