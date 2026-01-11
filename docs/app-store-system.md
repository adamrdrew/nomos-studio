# App Store System

## Overview
Nomos Studio has two related “stores”:

- **Main-process `AppStore`**: the source of truth for application state that is mutated by main-process services (settings load/update, assets indexing, map open/save/validate).
- **Renderer `useNomosStore` (Zustand)**: a lightweight, renderer-local cache that pulls a snapshot from main via IPC and refreshes when main emits a narrow change signal.

The renderer uses a narrow push signal (`nomos:state:changed`) to know when to refresh its snapshot (it still pulls the full snapshot on each refresh).

The store subsystem is intentionally small and synchronous, designed to keep application services decoupled from Electron/UI primitives while still providing shared state (e.g., enabling/disabling menu items based on whether a document is loaded).

## Architecture

### Main store (authoritative)
- `src/main/application/store/AppStore.ts`
	- Holds `AppState` in memory.
	- Provides `getState()` for read access.
	- Provides `subscribe(listener)` for synchronous change notifications.
	- Provides narrow setters used by services:
		- `setSettings(settings)`
		- `setAssetIndex(assetIndex)`
		- `setAssetIndexError(error)`
		- `setMapDocument(mapDocumentOrNull)`
		- `setMapRenderMode(mapRenderMode)`
		- `setMapGridIsVisible(isGridVisible)`
		- `setMapGridOpacity(gridOpacity)` (clamped and quantized to tenths)

Main-process services depend on `AppStore` (injected), not on Electron globals:
- `AssetIndexService` reads settings from `store.getState()` and writes `setAssetIndex` / `setAssetIndexError`.
- `MapValidationService` reads settings from `store.getState()`; it does not currently mutate the store.
- `OpenMapService` and `SaveMapService` read/write `mapDocument`.

The Electron main entrypoint (`src/main/main.ts`) creates one `AppStore` instance on app startup and wires it into the services.

### Renderer store (cached snapshot)
- `src/renderer/store/nomosStore.ts`
	- Zustand store that holds a renderer-local copy of:
		- `settings`
		- `assetIndex`
		- `mapDocument`
		- `mapRenderMode`
		- `mapSelection` (renderer-local UI selection)
	- `refreshFromMain()` calls `window.nomos.state.getSnapshot()` and updates the Zustand state.
	- `setMapSelection(...)` updates selection without calling main.

### IPC link
- The snapshot is defined in `src/shared/ipc/nomosIpc.ts` as `AppStateSnapshot` and returned from `NOMOS_IPC_CHANNELS.stateGet` (`nomos:state:get`).
- The preload surface exposes `window.nomos.state.getSnapshot()`.

### Snapshot refresh signal
- Main emits `nomos:state:changed` when the `AppStore` changes.
- Preload exposes `window.nomos.state.onChanged(listener)`.
- The renderer listens and calls `useNomosStore.refreshFromMain()`.

## Public API / entrypoints

### Main-process API
- `AppStore`
	- `getState(): AppState`
	- `subscribe(listener: AppStoreListener): () => void`
	- `setSettings(settings: EditorSettings): void`
	- `setAssetIndex(assetIndex: AssetIndex): void`
	- `setAssetIndexError(error: AssetIndexError): void`
	- `setMapDocument(mapDocument: MapDocument | null): void`
	- `setMapRenderMode(mapRenderMode: MapRenderMode): void`
	- `setMapGridIsVisible(isGridVisible: boolean): void`
	- `setMapGridOpacity(gridOpacity: number): void`

### Renderer API
- `useNomosStore` (Zustand hook)
	- `refreshFromMain(): Promise<void>`
	- `setMapSelection(selection: MapSelection | null): void`

### IPC / preload entrypoints
- `window.nomos.state.getSnapshot(): Promise<StateGetResponse>`
- `window.nomos.state.onChanged(listener: () => void): () => void`
- Main handler: `NomosIpcHandlers.getStateSnapshot()` in `src/main/main.ts`.

## Data shapes

### Main-process state
Defined in `src/main/application/store/AppStore.ts`:
```ts
type AppState = Readonly<{
	settings: EditorSettings;
	assetIndex: AssetIndex | null;
	assetIndexError: AssetIndexError | null;
	mapDocument: MapDocument | null;
	mapRenderMode: MapRenderMode;
	mapGridSettings: MapGridSettings;
}>;
```

### IPC snapshot state
Defined in `src/shared/ipc/nomosIpc.ts`:
```ts
type AppStateSnapshot = Readonly<{
	settings: EditorSettings;
	assetIndex: AssetIndex | null;
	mapDocument: MapDocument | null;
	mapRenderMode: MapRenderMode;
	mapGridSettings: MapGridSettings;
}>;

type StateGetResponse = Result<AppStateSnapshot, { message: string }>;
```

Note: the IPC snapshot currently does **not** include `assetIndexError`. The renderer can only read the successful index state, not the last indexing error.

### Renderer store state
Defined in `src/renderer/store/nomosStore.ts`:
```ts
type NomosStoreState = {
	settings: EditorSettings;
	assetIndex: AssetIndex | null;
	mapDocument: MapDocument | null;
	mapRenderMode: MapRenderMode;
	mapSelection: MapSelection | null;
	refreshFromMain: () => Promise<void>;
	setMapSelection: (selection: MapSelection | null) => void;
};
```

## Boundaries & invariants

### Security boundary (L03)
- `AppStore` lives in main process and is not directly accessible to renderer code.
- Renderer code can only read a snapshot via the preload/IPC API.

### Single source of truth
- The authoritative state is in main `AppStore`.
- Renderer state is a snapshot-based cache; it can be stale unless `refreshFromMain()` is called.
	- The `nomos:state:changed` event exists solely to trigger refresh; the renderer still pulls the full snapshot.

### Asset index vs error mutual exclusion
- `setAssetIndex(assetIndex)` clears `assetIndexError`.
- `setAssetIndexError(error)` clears `assetIndex`.

### Listener semantics
- `subscribe()` listeners are called synchronously on `emit()`.
- `subscribe()` returns an unsubscribe function; calling it stops further notifications.

### Menu enablement dependency
- The main process uses `store.getState().mapDocument !== null` to compute whether Save is enabled.
- `store.subscribe()` triggers re-installing the application menu when state changes.

### Render mode state
- `mapRenderMode` lives in `AppStore` so that both the View menu checked state and the renderer rendering mode stay consistent.

## How to extend safely

### Adding new state
- Add the field to `AppState` and initialize it in `AppStore`.
- Add a narrow setter method (avoid exposing a generic `setState` unless needed) so invariants remain explicit.
- Update `AppStore.test.ts` to cover new branches/invariants.

### Exposing state to renderer
- Extend `AppStateSnapshot` in `src/shared/ipc/nomosIpc.ts`.
- Update the `getStateSnapshot` handler in `src/main/main.ts` to include the new field.
- Update `useNomosStore.refreshFromMain()` to set the new field.

Prefer keeping the preload API minimal: expose only what the renderer needs for display.

### Push updates
- The renderer listens for the `nomos:state:changed` signal and refreshes its snapshot. Avoid introducing additional event streams unless there is a clear need.

## Testing notes
- Main `AppStore` unit tests live in `src/main/application/store/AppStore.test.ts` and cover:
	- default state
	- subscribe/unsubscribe behavior
	- `assetIndex` vs `assetIndexError` clearing invariants
	- setting/clearing `mapDocument`

- Renderer Zustand store currently has no unit tests; it is small and delegates to the typed preload `state.getSnapshot()` call.
