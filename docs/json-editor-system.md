# JSON Editor System

## Overview
Nomos Studio includes an in-app JSON editor for editing non-level `*.json` assets.

User-facing behavior:
- Double-clicking `Levels/*.json` opens the Map Editor (not the JSON editor).
- Double-clicking any other `*.json` opens the file in a Monaco-backed JSON editor tab.
- Tabs are siblings of the Map tab in the main editor surface.
- Tabs show dirty state via title color (red = unsaved, white = saved).
- File → Save saves the currently active editor (Map tab or active JSON tab).
- Run → Save & Run saves all open editors (dirty JSON tabs + map if dirty) and then runs.

## Architecture

### Renderer tab model
Renderer-local editor tab state lives in the Zustand store:
- `src/renderer/store/nomosStore.ts`

Core concepts:
- `activeEditorTabId`: discriminated tab identity
	- `'map'`
	- `` `json:${string}` `` where the string is the asset-relative path
- `jsonEditorTabs`: open JSON tabs, each with:
	- `relativePath` (asset-relative, POSIX separators)
	- `fileName` (basename shown in the tab)
	- `model` (Monaco `ITextModel`)
	- dirty tracking fields (`lastSavedText`, `isDirty`)
	- a change subscription disposable that is disposed on close

Resource safety (L05):
- Closing a JSON tab disposes both the Monaco model and the change subscription.

### Monaco editor integration
- UI component: `src/renderer/ui/editor/panels/JsonEditorPanel.tsx`
- The Monaco editor is created against the existing tab model (`ITextModel`) so tab switches don’t require reloading from disk.
- Theme: `vs-dark`.

CSP requirements:
- Monaco uses workers; the renderer CSP must allow `worker-src 'self' blob:`.

### Main/preload filesystem boundary
Renderer code never reads/writes the filesystem directly (L03, L06).

Instead, JSON tabs use typed preload IPC:
- Read JSON text:
	- `window.nomos.assets.readJsonText({ relativePath })`
	- IPC channel: `nomos:assets:read-json-text`
- Write JSON text:
	- `window.nomos.assets.writeJsonText({ relativePath, text })`
	- IPC channel: `nomos:assets:write-json-text`

Safety constraints (L06):
- Both operations reject missing `assetsDirPath`.
- Both reject empty/whitespace paths, absolute paths, null bytes, and traversal outside the configured assets directory.
- Both restrict to `.json` paths.
- Writes use a safe-write strategy (temp + replace).

### Menu routing and save orchestration
Menu items are treated as *requests* from main → renderer so the renderer can route saves based on the active tab:
- Main → renderer events:
	- `nomos:menu:save-requested`
	- `nomos:menu:save-and-run-requested`
- Renderer subscription point:
	- `src/renderer/ui/editor/EditorShell.tsx`

Save behavior:
- Save (active tab):
	- Map tab: invokes existing map save IPC.
	- JSON tab: writes JSON text and updates `lastSavedText` / `isDirty`.

Save & Run behavior:
- Renderer saves all dirty JSON tabs in deterministic order (sorted by `relativePath`).
- Renderer saves the map if dirty.
- Renderer then invokes main “Save & Run” via:
	- `window.nomos.map.saveAndRun()`
	- IPC channel: `nomos:map:save-and-run`

Failure behavior:
- Save-all stops on the first failure and does not run.

## Public API / entrypoints

### Renderer store
- `openJsonEditorTab(relativePath: string)`
- `closeJsonEditorTab(tabId: string)`
- `setActiveEditorTabId(tabId: 'map' | string)`
- `saveActiveEditorTab()`
- `saveAllEditorsAndRun()`

### Preload API
- `window.nomos.assets.readJsonText({ relativePath })`
- `window.nomos.assets.writeJsonText({ relativePath, text })`
- `window.nomos.menu.onSaveRequested(listener)`
- `window.nomos.menu.onSaveAndRunRequested(listener)`
- `window.nomos.map.saveAndRun()`

## Key invariants
- JSON editor capabilities are intentionally narrow: read/write is restricted to `.json` under `assetsDirPath`.
- JSON tab titles are basenames; tab identity uses the full relative path.
- No persistence of open JSON tabs across app restarts.
