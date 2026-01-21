# Phase 0019 — File Menu + File Handling Enhancements

## Intent
Make file workflows feel like a real editor:
- Let users start fresh (**New Map**) and discard the current document safely.
- Provide idiomatic **Save As…** behavior.
- Protect users from losing work by warning on **Open/New/Quit** when there are unsaved changes.
- Improve in-app file affordances (double-click map assets loads in-editor; **Recent Maps** list).

This Phase exists now because the app already has a main-owned `MapDocument` with `dirty` tracking, main-owned undo/redo history, a testable menu template factory, and a typed preload/IPC surface.

## Scope

### In scope

#### A) File menu additions
- Add **New Map** to the File menu.
  - Prompts if the current map has unsaved changes.
  - Resets the editor back to a blank state in the same window by clearing the current map document and edit history.
  - Leaves settings and the assets index intact.

- Add **Save As…** to the File menu.
  - Shows an idiomatic save dialog.
  - Saves the current document to a newly chosen path.
  - Updates internal state so the app considers the new path to be the current document path.

- Add **Recent Maps** submenu in the File menu.
  - Shows up to the last 5 successfully opened map file paths.
  - Selecting an entry opens that map (with unsaved-changes guarding).
  - The list is persistent across app restarts.

#### B) Unsaved-changes guarding
Add a shared main-process “dirty document guard” used by:
- Open Map… (from File menu)
- New Map
- Recent Maps open
- Open map from Asset Browser double-click
- App quit / main window close

Behavior:
- If no map is open, or the open map is not dirty: proceed immediately.
- If a dirty map is open: show a warning prompt with choices:
  - **Save** → attempt to save; if save succeeds, proceed; if save fails, abort the operation.
  - **Don’t Save** → proceed and discard changes.
  - **Cancel** → abort the operation.

#### C) Asset Browser map-open integration
- Introduce an extensible “asset action router” for double-click actions in the Asset Browser.
  - The router chooses an action based on the asset’s relative path (and potentially file type).
  - Initial rule: double-clicking a map file under `Assets/Levels` loads it in the editor (instead of opening via OS shell handler).
  - Non-matching assets continue to use the existing OS shell open behavior.
- Map-open from asset browser uses the same unsaved-changes guard.

#### D) Recent maps tracking
- Update recent list on successful map open (from any entrypoint).
- Dedupe paths (move to top if already present) and cap at 5.
 - Persist changes to disk in a cross-platform, userData-scoped location.
   - Store as a JSON file named `recent-maps.json` under Electron’s `app.getPath('userData')` directory.
   - Loading behavior must be resilient:
     - If the file does not exist yet, treat as an empty list.
     - If the file exists but is invalid/corrupt/unparseable, treat as an empty list (and do not crash the UI).

### Out of scope
- Creating a new in-memory “Untitled” map document. New Map means “reset editor to blank with no document loaded”.
- New map file format/schema changes.
- Bulk file operations (export, autosave, backups beyond existing safe-write behavior).
- Adding renderer component test infrastructure.

## Constraints
- **L01 Cross-platform parity:** dialogs, menu items, and quit behavior must be correct on macOS/Windows/Linux.
- **L02 Offline:** no network requirements.
- **L03 Electron security:** keep privileged operations in main; add minimal preload/IPC only if needed.
- **L04 Testing:** new/changed public methods must have unit tests covering all conditional paths.
- **L08 Testability:** guard logic and any new orchestration must be injectable and unit-testable without Electron.
- **L06 Non-destructive by default:** no silent data loss; discards require explicit user confirmation.
- **L09 Docs:** update relevant subsystem docs to match new menu items and file behaviors.

## Assumptions (explicit)
- A “map file” is a JSON file under the assets-relative path prefix `Levels/` (POSIX separators) with extension `.json` (case-insensitive).
- The unsaved-changes prompt uses the standard **Save / Don’t Save / Cancel** triad.
- Save As… updates the current document’s `filePath` to the newly selected path and marks `dirty: false` on success.
- Recent Maps is persisted as `recent-maps.json` under Electron’s `app.getPath('userData')` directory, displayed as filesystem paths.
- Missing `recent-maps.json`, an empty file, or invalid JSON must not crash the app; the UI should behave as if the list is empty.
- The Asset Browser double-click behavior is driven by an explicit routing table / strategy list so new in-editor asset actions can be added without growing conditionals.

## Acceptance criteria

### New Map
- File menu contains **New Map**.
- When invoked with a non-dirty map open:
  - current `mapDocument` becomes `null`.
  - undo/redo history is cleared (menu shows Undo/Redo disabled).
  - renderer selection is cleared (no stale selection UI).
- When invoked with a dirty map open:
  - the unsaved-changes prompt appears and behaves per guard rules.

### Save As…
- File menu contains **Save As…**.
- Save As… opens an OS save dialog.
- If the user cancels, no changes occur.
- If the user chooses a path:
  - the map is written to that path using existing safe-write rules.
  - the in-memory `MapDocument.filePath` becomes the new path.
  - the document becomes `dirty: false`.

### Open-map guard
- When a dirty map is open and the user tries to open another map (via Open Map…, Recent Maps, or Asset Browser double-click), the prompt is shown and:
  - Save → saves and then opens the new map.
  - Don’t Save → opens the new map and discards previous changes.
  - Cancel → no open occurs; current map remains.

### Asset Browser double-click
- Double-clicking a map asset under `Levels/` loads it into the editor (it does not call the OS open handler).
- Double-clicking non-map assets continues to open via the OS handler.

### Recent Maps
- File menu contains a **Recent Maps** submenu.
- The submenu shows the last 5 successfully opened maps (most recent first), with no duplicates.
- Selecting a recent map opens it (using the unsaved-changes guard).
- Recent maps persist across app restart (closing and reopening the app retains the list).
- If `recent-maps.json` is missing/empty/invalid, the submenu still renders and simply shows no recent entries.

### Quit guard
- If a dirty map is open and the user quits/closes the app:
  - The unsaved-changes prompt appears.
  - Save → saves then quits.
  - Don’t Save → quits without saving.
  - Cancel → aborts quit.

### Quality gates
- `npm test`, `npm run typecheck`, and `npm run lint` pass.
- Docs updated under `docs/` for any changed subsystems.

## Risks / notes
- Electron quit/close flows differ subtly by platform; implement the quit guard in a way that is correct across macOS/Windows/Linux (L01).
- Avoid widening preload surface area unless the renderer cannot reasonably trigger a behavior via existing IPC (L03). The Asset Browser map-open likely requires a new, narrow IPC method.
- Ensure guard flows do not re-enter (e.g., avoid infinite loops when re-triggering `app.quit()` after an async save).

