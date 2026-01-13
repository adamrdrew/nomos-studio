# IPC System

## Overview
Nomos Studio uses a typed, invoke-style IPC surface to bridge the renderer (unprivileged) to the main process (privileged). The contract is centralized in `src/shared/ipc/nomosIpc.ts` and exposed to the renderer via the preload `window.nomos` API.

Key goals:
- Keep privileged operations out of the renderer (L03).
- Keep the IPC contract explicit and typed.
- Limit surface area (only expose what the renderer needs).

In addition to invoke-style calls, Nomos Studio also uses a single narrow main→renderer event (`nomos:state:changed`) to notify the renderer that it should refresh its snapshot.
This event may include a small typed payload for selection reconciliation.

## Architecture

### Contract definition (shared)
- `src/shared/ipc/nomosIpc.ts`
	- `NOMOS_IPC_CHANNELS`: the canonical list of channels.
	- Request/response types for each channel.
	- Shared payload shapes for state snapshots.

### Main-process handler registration
- `src/main/ipc/registerNomosIpcHandlers.ts`
	- Defines `NomosIpcHandlers`: a typed collection of handler functions.
	- Registers each handler with `ipcMain.handle(channel, ...)`.
	- Casts `unknown` args into typed request objects where relevant.

The production handlers are implemented/wired in `src/main/main.ts`.

### Preload exposure
- `src/preload/preload.ts`
	- Calls `ipcRenderer.invoke(channel, payload)`.
	- Exposes a minimal API in `window.nomos` via `contextBridge.exposeInMainWorld`.

- `src/preload/nomos.d.ts`
	- Declares the `window.nomos` TypeScript type surface for renderer code.

## Public API / entrypoints

### Renderer-facing API
The renderer must only use the preload API:
- `window.nomos.settings.get()` / `window.nomos.settings.update(updates)`
- `window.nomos.dialogs.pickDirectory()` / `pickFile()` / `openMap()`
- `window.nomos.assets.refreshIndex()`
- `window.nomos.assets.open({ relativePath })`
- `window.nomos.assets.readFileBytes({ relativePath })`
- `window.nomos.map.validate({ mapPath })` / `open({ mapPath })` / `save()` / `edit({ command })`
- `window.nomos.map.undo()` / `window.nomos.map.redo()`
- `window.nomos.state.getSnapshot()`
- `window.nomos.state.onChanged(listener)`

### IPC channels
Channels (canonical):
- `nomos:settings:get`
- `nomos:settings:update`
- `nomos:dialogs:pick-directory`
- `nomos:dialogs:pick-file`
- `nomos:dialogs:open-map`
- `nomos:assets:refresh-index`
- `nomos:assets:open`
- `nomos:assets:read-file-bytes`
- `nomos:map:validate`
- `nomos:map:open`
- `nomos:map:save`
- `nomos:map:edit`
- `nomos:map:undo`
- `nomos:map:redo`
- `nomos:state:get`
- `nomos:state:changed` (event)

## Data shapes

All request/response types are defined in `src/shared/ipc/nomosIpc.ts`.

### Result envelope
IPC responses generally use the shared `Result<TValue, TError>` discriminated union:
```ts
type Result<TValue, TError> =
	| Readonly<{ ok: true; value: TValue }>
	| Readonly<{ ok: false; error: TError }>;
```

### Settings
- `SettingsGetResponse = Result<EditorSettings, SettingsError>`
- `SettingsUpdateRequest = Partial<EditorSettings>`
- `SettingsUpdateResponse = Result<EditorSettings, SettingsError>`

### Dialogs
- `PickDirectoryResponse = Result<string | null, { message: string }>`
- `PickFileResponse = Result<string | null, { message: string }>`
- `OpenMapDialogResponse = Result<string | null, { message: string }>`

### Assets
- `RefreshAssetIndexResponse = Result<AssetIndex, AssetIndexError>`
- `OpenAssetRequest = Readonly<{ relativePath: string }>`
- `OpenAssetResponse = Result<null, OpenAssetError>`

Read file bytes:
- `ReadAssetFileBytesRequest = Readonly<{ relativePath: string }>`
- `ReadAssetFileBytesResponse = Result<Uint8Array, ReadAssetError>`

### Maps
- `ValidateMapRequest = Readonly<{ mapPath: string }>`
- `ValidateMapResponse = Result<null, MapValidationError>`
- `OpenMapRequest = Readonly<{ mapPath: string }>`
- `OpenMapResponse = Result<MapDocument, MapIoError | MapValidationError>`
- `SaveMapResponse = Result<MapDocument, MapIoError>`

Edit map:
- `MapEditTargetRef = { kind: 'light' | 'particle' | 'entity'; index: number } | { kind: 'door'; id: string }`
- `MapEditAtomicCommand = { kind: 'map-edit/delete' | 'map-edit/clone'; target: MapEditTargetRef }`
- `MapEditCommand = MapEditAtomicCommand | { kind: 'map-edit/transaction'; label?: string; commands: readonly MapEditAtomicCommand[]; selection?: { kind: 'map-edit/selection'; ref: MapEditTargetRef | null } }`
- `MapEditRequest = Readonly<{ command: MapEditCommand }>`
- `MapEditResult = { kind: 'map-edit/deleted' } | { kind: 'map-edit/cloned'; newRef: MapEditTargetRef } | { kind: 'map-edit/applied'; selection: MapEditSelectionEffect; history: MapEditHistoryInfo }`
- `MapEditResponse = Result<MapEditResult, MapEditError>`

Undo/redo:
- `MapUndoRequest = Readonly<{ steps?: number }>`
- `MapUndoResponse = Result<MapEditResult, MapEditError>`
- `MapRedoRequest = Readonly<{ steps?: number }>`
- `MapRedoResponse = Result<MapEditResult, MapEditError>`

### State snapshot
- `AppStateSnapshot = Readonly<{ settings: EditorSettings; assetIndex: AssetIndex | null; mapDocument: MapDocument | null; mapRenderMode: MapRenderMode; mapGridSettings: MapGridSettings; mapHistory: MapEditHistoryInfo }>`
- `StateGetResponse = Result<AppStateSnapshot, { message: string }>`

### State changed event
- Main emits `nomos:state:changed` when `AppStore` changes.
- Preload exposes `window.nomos.state.onChanged(listener)` which returns an unsubscribe function.

Optional payload:
- The event may include a `StateChangedPayload` object.
- Today the only payload used is `selectionEffect?: MapEditSelectionEffect`, which allows main-triggered operations (e.g., menu Undo/Redo) to reconcile renderer selection without renderer-side heuristics.

## Boundaries & invariants

### Security boundary (L03)
- Renderer must not access Node/Electron privileged APIs directly.
- Privileged operations (filesystem, process execution, dialogs) live in main.
- Preload is the only renderer entrypoint and should remain narrow.

### Typed contract lives in shared
- Channels and payload shapes are defined once in `src/shared/ipc/nomosIpc.ts`.
- Both main and renderer import from this file to avoid drift.

### Invoke/handle pattern
- All operations use `ipcRenderer.invoke` + `ipcMain.handle` (request/response style).
- State is still pulled via `state:get`, but the renderer is notified via a narrow event so it knows when to refresh.

### Runtime validation
- `registerNomosIpcHandlers` receives `unknown` args from Electron and casts them to typed requests.
- Today, handlers generally assume the renderer sends correct payload shapes.
- When adding channels that could have safety implications, validate `unknown` inputs explicitly in the handler layer.

## How to extend safely

### Adding a new IPC operation
1. Add a channel constant to `NOMOS_IPC_CHANNELS` in `src/shared/ipc/nomosIpc.ts`.
2. Add request/response types in the same file (prefer `Result<...>` with typed errors).
3. Extend `NomosIpcHandlers` in `src/main/ipc/registerNomosIpcHandlers.ts`.
4. Register the channel in `registerNomosIpcHandlers`.
5. Expose a minimal wrapper in `src/preload/preload.ts` and update `src/preload/nomos.d.ts`.
6. Consume via `window.nomos.*` in the renderer.

### Keep surface area minimal
- Prefer specific operations (e.g., `saveMap()`) over general “execute arbitrary command” IPC.
- Do not expose filesystem paths or raw system APIs unless necessary.

### Consider state sync
- If the renderer needs to react to state changes without polling, add a dedicated event channel and keep it typed and narrowly scoped.

## Testing notes
- `src/main/ipc/registerNomosIpcHandlers.test.ts` verifies that:
	- all channels are registered
	- handlers are wired to the expected channel names
	- request casting paths call the correct handler functions

- Application services that back IPC handlers are tested in their own subsystem tests (e.g., settings/assets/maps service tests).
