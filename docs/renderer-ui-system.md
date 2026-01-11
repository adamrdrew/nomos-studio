# Renderer UI System

## Overview
The renderer UI subsystem contains the React UI that runs in Electron renderer processes.

Current responsibilities:
- Render the main “editor shell” UI (DockView layout) including the Map Editor surface and Inspector panels.
- Render the currently-open map (wireframe or textured) in the Map Editor canvas.
- Support Select-tool hit-testing and read-only Properties display.
- Render Settings UI in two contexts:
	- As a modal dialog inside the main window.
	- As a dedicated Settings window when launched in “settings mode”.
- Pull a read-only snapshot of main-process state via the preload API and store it in a small renderer store.

## Architecture

### Entry points
- `src/renderer/index.html`
	- Defines the root element and sets a CSP meta tag from Webpack configuration.

- `src/renderer/renderer.tsx`
	- React entrypoint.
	- Implements settings-mode routing via URL query.
	- Contains the Settings UI (`SettingsPanel`) and renders the editor shell in normal mode.

- `src/renderer/ui/editor/EditorShell.tsx`
	- DockView-based editor shell.
	- Creates the main DockView panels:
		- Map Editor (center)
		- Inspector (right)
	- Refreshes the renderer snapshot on mount.
	- Subscribes to main→renderer state changes and refreshes automatically.

- `src/renderer/ui/editor/MapEditorCanvas.tsx`
	- Konva `Stage`/`Layer` based map viewport.
	- Renders:
		- wireframe walls + doors
		- textured floors + walls (best-effort)
		- entity/emitter markers
	- Implements Select-mode hit-testing and updates the selection state.

### State management
Renderer state is intentionally small:

- `src/renderer/store/nomosStore.ts` (`useNomosStore`)
	- Zustand store that caches a snapshot of main state.
	- Populated by calling `refreshFromMain()` which invokes `window.nomos.state.getSnapshot()`.
	- Also stores renderer-local UI state:
		- `mapSelection` (selected map object identity)

### Preload/IPC integration
Renderer code calls the typed preload surface `window.nomos.*` for privileged operations:
- Settings read/write: `window.nomos.settings.get()` and `window.nomos.settings.update(...)`
- File/directory dialogs: `window.nomos.dialogs.*`
- Open asset in OS: `window.nomos.assets.open({ relativePath })`
- Read asset bytes (for textures): `window.nomos.assets.readFileBytes({ relativePath })`
- Map operations: `window.nomos.map.*`
- State snapshot: `window.nomos.state.getSnapshot()`
- State change subscription: `window.nomos.state.onChanged(listener)`

## Editor UI (normal mode)

The editor UI is organized like a traditional creative tool:
- **Map Editor** panel (center): a React Konva surface (`Stage`/`Layer`) that renders a graph-paper grid and supports pan/zoom.
	- When a map is open, `MapEditorCanvas` decodes `mapDocument.json` and renders the map.
	- Rendering style is controlled by `mapRenderMode` (`wireframe` / `textured`).
	- On map open, the view is initialized so the viewport center corresponds to world-space `(0,0)` and the map is framed to be visible immediately.
		- To achieve this for arbitrary authored coordinates, the renderer may apply a render-only origin offset derived from decoded map bounds; this does not mutate `MapDocument.json`.
	- The editor grid adapts its spacing to zoom so line density stays readable.
	- Object markers (doors/entities/emitters) are sized in screen pixels and do not grow with zoom; light radius remains world-space.
- **Tool palette** (left overlay within the Map Editor): Select / Zoom / Pan tool modes. Pan and zoom interactions are gated by the selected tool.
- **Inspector** panel (right): contains collapsible sections, currently Asset Browser and Properties.
	- Properties shows the selected map object (read-only) when Select tool chooses something.

## Public API / entrypoints

### App entrypoint
- `src/renderer/renderer.tsx` is the renderer bundle’s main entry.

### Mode selection
- “Settings mode” is selected by URL query:
	- `nomosSettings=1` (or `true`)

This is used by the Settings window to render a dedicated settings view.

## Data shapes

### Settings form fields
Settings UI uses two strings (nullable in persisted settings):
- `assetsDirPath: string` (empty string treated as null)
- `gameExecutablePath: string` (empty string treated as null)

### Renderer store snapshot
`useNomosStore.refreshFromMain()` loads `AppStateSnapshot` via IPC and stores:
- `settings: EditorSettings`
- `assetIndex: AssetIndex | null`
- `mapDocument: MapDocument | null`
- `mapRenderMode: MapRenderMode`

## Boundaries & invariants

### Security boundary (L03)
- Renderer must not access Node or OS APIs directly.
- All privileged operations must go through the preload/IPC API (`window.nomos`).

### Settings mode behavior
- When in settings mode:
	- The root UI renders only the Settings panel.
	- “Done” and “Cancel” close the window.

### State freshness
- Renderer state is snapshot-based.
- The renderer refreshes on mount and also subscribes to main→renderer `state:changed` so state updates propagate without polling.

## How to extend safely

### Adding new renderer features
- Prefer to:
	- add a typed IPC command and preload wrapper when a privileged operation is required, or
	- keep work entirely renderer-local for pure UI state.

### Adding new settings fields
- Extend the shared `EditorSettings` model.
- Update the settings UI to round-trip new fields through `window.nomos.settings.get/update`.
- Keep validation and persistence in the main process; renderer should only collect user input and display errors.

### Keep preload API minimal
- Avoid exposing new preload methods unless the renderer truly needs them.

## Testing notes
- There are currently no dedicated renderer component tests in this repository.
- Renderer behavior is indirectly covered by unit tests of the main services and IPC wiring; manual verification is used for UI flows.
