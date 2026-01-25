# Phase 0041 — Steps

## S001 — Select Monaco integration approach
- **Intent:** Choose a Monaco integration compatible with Electron Forge + Webpack and the app’s security posture.
- **Work:**
  - Evaluate adding `monaco-editor` with either a small wrapper component or `@monaco-editor/react`.
  - Identify any required webpack configuration (workers, asset loading) and CSP implications.
  - Decide on a built-in dark theme (`vs-dark`) or a custom theme.
- **Done when:** A short decision note is recorded in the implementation PR describing the chosen packages/config changes.

## S002 — Add typed IPC for JSON text read
- **Intent:** Enable renderer to open JSON content without Node access.
- **Work:**
  - Extend `src/shared/ipc/nomosIpc.ts` with a new channel and request/response types for reading JSON text by asset-relative path.
  - Implement a main-process handler with traversal protection consistent with existing asset read-bytes behavior.
  - Expose the method in preload and add/extend `src/preload/nomos.d.ts`.
- **Done when:** Renderer can request JSON file text via `window.nomos.*` and unit tests cover success + rejection branches.

## S003 — Add typed IPC for JSON text write (safe write)
- **Intent:** Enable saving JSON back to disk safely.
- **Work:**
  - Add a new channel/types for writing JSON text by relative path.
  - Implement safe-write behavior (temp + atomic replace) similar to map save.
  - Ensure traversal protection and `.json` restriction.
- **Done when:** A unit test suite covers write success and each validation failure branch.

## S004 — Update Asset Browser double-click routing
- **Intent:** Make JSON open in-app instead of external.
- **Work:**
  - Update the Asset Browser’s double-click handler so:
    - `Levels/*.json` continues to open the map.
    - other `*.json` opens a JSON editor tab.
    - non-JSON continues to use OS open.
- **Done when:** Manual verification confirms the routing, and any existing tests are updated or extended accordingly.

## S005 — Introduce renderer editor-tab state model
- **Intent:** Create a renderer-local model for an arbitrary number of JSON tabs.
- **Work:**
  - Define data structures for:
    - open JSON tabs (relative path, basename, dirty flag, lastSavedText, and Monaco model reference)
    - active tab identity (`map` vs `json:<relativePath>`)
  - Ensure tab close disposes Monaco resources.
- **Done when:** Opening and closing tabs is possible with deterministic cleanup and no console errors.

## S006 — Implement scrollable tab bar UI
- **Intent:** Support many tabs without layout breakage.
- **Work:**
  - Add a tab strip UI above the editor surface.
  - Ensure horizontal scroll on overflow (`overflow-x: auto`, non-wrapping labels).
  - Implement Map tab as fixed, non-closable; JSON tabs show left-side X.
- **Done when:** Opening many JSON tabs demonstrates scrolling and close behavior.

## S007 — Implement JSON editor panel using Monaco
- **Intent:** Provide a first-class JSON editing experience.
- **Work:**
  - Render Monaco in a JSON tab.
  - Configure JSON language mode and diagnostics for malformed JSON.
  - Ensure a dark theme is applied.
- **Done when:** Malformed JSON produces Monaco markers and syntax highlighting is visible.

## S008 — Dirty tracking and title coloring
- **Intent:** Provide accurate save state feedback.
- **Work:**
  - Mark JSON tab dirty on editor changes (compare against last saved text).
  - Apply title color rules (red unsaved, white saved).
  - Apply the same rule to the Map tab title using `mapDocument.dirty` from snapshot.
- **Done when:** Dirty indicators behave as specified for both map and JSON.

## S009 — Route menu Save to active editor
- **Intent:** Save command affects the currently focused editor.
- **Work:**
  - Extend the menu wiring so File → Save triggers a renderer-handled “save current tab” command.
  - Implement renderer handler:
    - if active is Map tab: call existing map save IPC
    - if active is JSON tab: call JSON write IPC with current text
  - Define failure UX (error dialog via existing notifier patterns).
- **Done when:** Save works correctly for both editor types via menu.

## S010 — Route Save & Run to save-all + run
- **Intent:** Save & Run saves all open editors (map + JSON) before running.
- **Work:**
  - Add a renderer-handled “save all” operation that saves:
    - all dirty JSON tabs
    - the map (if dirty)
  - Add an IPC entrypoint to invoke the existing main-process Save & Run service from the renderer.
  - Ensure Save & Run menu item triggers this renderer flow.
- **Done when:** Save & Run performs save-all then validate/run; failures prevent run.

## S011 — Update docs
- **Intent:** Keep subsystem documentation current (L09).
- **Work:**
  - Update:
    - `docs/assets-system.md` (double-click routing)
    - `docs/menu-system.md` (save routing)
    - `docs/renderer-ui-system.md` (tab system + JSON editor)
  - Add `docs/json-editor-system.md` (or `docs/editor-tabs-system.md`) describing the JSON editor architecture, IPC calls, and invariants.
- **Done when:** Docs match implemented behavior and expose the new IPC/API surfaces.

## S012 — Test pass + regression checks
- **Intent:** Ensure the phase is reviewable and green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, and `npm run lint`.
  - Verify critical manual flows:
    - open JSON from asset browser
    - edit + dirty indicator
    - Save on JSON
    - Save on map
    - Save & Run saves all then runs
- **Done when:** All automated checks pass and manual acceptance flows succeed.
