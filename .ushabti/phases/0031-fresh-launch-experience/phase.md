# Phase 0031 — Fresh Launch Experience

## Intent
Replace the current “drop straight into the editor with no real document” startup behavior with a dedicated Fresh Launch view that guides users to:
- Create a new map (backed by a chosen file path)
- Open an existing map
- Open a recent map
…and clearly indicates when required settings are missing.

This Phase exists now because the current startup state is confusing and inconsistent (editor UI shown with no backed document, and no clear configuration guidance).

## Scope

### In scope
- Add a new renderer view (Fresh Launch) that is shown when:
  - Not in settings mode, and
  - No map is currently open (`mapDocument === null`).
- Fresh Launch UI requirements:
  - App name “Nomos Studio” displayed in the upper-left.
  - Two large central tiles/buttons:
    - **Create New** → prompts for destination `.json` path and creates a new in-memory map document backed by that path.
    - **Open Existing** → opens the existing “Open Map…” dialog and loads the selected map.
  - Recent maps list under the tiles:
    - Uses the same recent-maps source as the File menu (same ordering, max entries, dedupe behavior).
    - Clicking a recent map opens it in the editor.
  - Missing configuration warning:
    - If `settings.assetsDirPath === null` OR `settings.gameExecutablePath === null`, show red warning text above the tiles telling the user the editor is not configured and to use Settings.
- Ensure the UI transitions to the existing editor shell when a map becomes loaded/created.
- Extend main→renderer state snapshot so the renderer can render recent maps.
- Add an IPC/preload entrypoint enabling the renderer to initiate “Create New” (save dialog + new document creation) without breaking security boundaries.
- Update relevant subsystem documentation under `docs/`.
- Add unit tests for new/changed public methods and branchy paths (L04).

### Out of scope
- Redesigning the editor shell (DockView layout, panels, tools).
- Introducing a project/workspace concept beyond existing settings.
- Changing validation prerequisites for opening maps (still requires both settings).
- Changing the map file format or adding schema enforcement.
- Adding networked features (L02).

## Constraints
- Must preserve cross-platform behavior (L01). Any dialog/path handling must work on macOS, Windows, and Linux.
- Must preserve Electron security posture (L03): renderer uses only `window.nomos.*` APIs; no Node integration.
- Must remain offline-capable (L02).
- Public methods added/changed must have unit tests covering all conditional paths (L04).
- Side effects must stay behind injectable seams for testability (L08).
- Update subsystem docs that change (L09), especially renderer UI, IPC, menu/recents, and store snapshot.
- Follow boundaries from `.ushabti/style.md` (Domain/Application/Infrastructure/UI; minimal public surface; avoid unnecessary dependencies).

## Acceptance criteria
- On launch (normal mode), if no map is open, the Fresh Launch view is shown instead of the editor shell.
- Fresh Launch view displays:
  - “Nomos Studio” top-left.
  - Two large tiles/buttons: Create New and Open Existing.
  - Recent maps list below the tiles.
- Create New behavior:
  - Opens a Save dialog filtered to `.json`.
  - If the dialog is cancelled, nothing changes.
  - If a path is chosen, a new map document is created with `filePath` set to the chosen path and the app transitions to the editor shell.
- Open Existing behavior:
  - Opens the existing Open Map dialog.
  - Cancel does nothing.
  - Selecting a map opens it and transitions to the editor shell.
- Recent maps behavior:
  - List content matches File → Recent Maps (same source and ordering).
  - Clicking an entry opens it and transitions to the editor shell.
- Missing configuration warning:
  - When either required setting is missing, red warning text is shown above the tiles.
  - Warning text includes a clear instruction to open Settings (e.g., mention `CommandOrControl+,`).
- No regression in menu functionality (File/Open/New/Recent), and menu recents remain correct.
- Unit tests added/updated for all new/changed public methods and key branches; `npm test -- --runInBand` passes.
- Lint/typecheck remain green (`npm run lint`, `npm run typecheck`).
- Docs updated to reflect new startup routing and new IPC/state fields.

## Risks / notes
- Recent maps are currently menu-owned state; to keep renderer + menu in sync, we likely need to promote recent map paths into `AppStore` and the state snapshot. This touches multiple subsystems and requires doc updates.
- “Create New” from renderer requires a new IPC surface (or an extracted workflow used by both menu and renderer). Keep surface area minimal and typed.
- Ensure Fresh Launch view still refreshes snapshot and subscribes to main state changes so it reacts immediately when maps are opened via the menu.
