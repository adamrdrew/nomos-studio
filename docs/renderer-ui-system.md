# Renderer UI System

## Overview
The renderer UI subsystem contains the React UI that runs in Electron renderer processes.

Current responsibilities:
- Render the main “editor shell” UI (DockView layout) including the Map Editor surface and Inspector panels.
- Render the currently-open map (wireframe or textured) in the Map Editor canvas.
- Support Select-tool hit-testing and Properties display/editing.
- Render Settings UI in two contexts:
	- As a dedicated Settings window when launched in “settings mode”.
- Pull a read-only snapshot of main-process state via the preload API and store it in a small renderer store.

## Architecture

### Entry points
- `src/renderer/index.html`
	- Defines the root element and sets a CSP meta tag from Webpack configuration.
	- **CSP note (textures):** textured rendering currently loads images from in-memory bytes using `URL.createObjectURL(...)`, which produces `blob:` image URLs. The effective CSP must therefore include `img-src 'self' data: blob:`.

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
	- **Textured rendering + CSP constraints:**
		- The renderer requests texture bytes via `window.nomos.assets.readFileBytes({ relativePath })`.
		- Bytes are converted to an image by creating a `blob:` object URL and loading it into an `HTMLImageElement`.
		- The renderer CSP must allow `blob:` image URLs via `img-src`.
		- While textures are loading (or when a texture is missing), the viewer avoids large placeholder fills:
			- floors are not filled until the texture image is available
			- walls fall back to a wireframe segment until the wall texture image is available

### State management
Renderer state is intentionally small:

- `src/renderer/store/nomosStore.ts` (`useNomosStore`)
	- Zustand store that caches a snapshot of main state.
	- Populated by calling `refreshFromMain()` which invokes `window.nomos.state.getSnapshot()`.
	- Also stores renderer-local UI state:
		- `mapSelection` (selected map object identity)
	- Includes snapshot fields used by UI enablement and rendering:
		- `mapGridSettings`
		- `mapHistory`

### Preload/IPC integration
Renderer code calls the typed preload surface `window.nomos.*` for privileged operations:
- Settings read/write: `window.nomos.settings.get()` and `window.nomos.settings.update(...)`
- File/directory dialogs: `window.nomos.dialogs.*`
- Open asset in OS: `window.nomos.assets.open({ relativePath })`
- Read asset bytes (for textures): `window.nomos.assets.readFileBytes({ relativePath })`
- Map operations: `window.nomos.map.*`
- State snapshot: `window.nomos.state.getSnapshot()`
- State change subscription: `window.nomos.state.onChanged(listener)`
	- The listener may receive an optional payload (currently `selectionEffect?: MapEditSelectionEffect`) for deterministic selection reconciliation.

## Editor UI (normal mode)

The editor UI is organized like a traditional creative tool:
- **Map Editor** panel (center): a React Konva surface (`Stage`/`Layer`) that renders a graph-paper grid and supports pan/zoom.
	- When a map is open, `MapEditorCanvas` decodes `mapDocument.json` and renders the map.
	- Rendering style is controlled by `mapRenderMode` (`wireframe` / `textured`).
		- Default is `textured`.
		- Textured rendering uses repeated (tiled) patterns at a consistent world-units-per-tile scale so textures remain legible rather than appearing as a single stretched image.
		- **Wall thickness rules:**
			- Wireframe walls use non-scaling strokes (thin at any zoom).
			- Textured walls use a screen-space thickness (approximately constant pixels on screen) so textures are visible without walls becoming enormous at high zoom.
	- On map open, the view is initialized so the viewport center corresponds to world-space `(0,0)` and the map is framed to be visible immediately.
		- To achieve this for arbitrary authored coordinates, the renderer may apply a render-only origin offset derived from decoded map bounds; this does not mutate `MapDocument.json`.
	- The editor grid adapts its spacing to zoom so line density stays readable.
	- Grid visibility and opacity are controlled by main-process state (`mapGridSettings`) and updated via the View menu.
	- Object markers (doors/entities/emitters) are sized in screen pixels and do not grow with zoom; light radius remains world-space.
- **Toolbox** (left overlay within the Map Editor): Select / Zoom / Pan tool modes.
	- Move mode allows dragging the currently selected entity to a new position.
		- The renderer maintains a local preview while dragging.
		- On mouse-up, the renderer commits a single main-process edit (`map-edit/move-entity`) and clears the preview.
	- Buttons are icon-based with tooltips, fill the toolbox width, and do not stretch to fill the vertical space.
	- The toolbox is a compact, scrollable column so additional tools can be added without odd stretching.

- **Tool bar** (row above the Map Editor canvas): tool-specific commands for the currently selected tool.
	- Tool bar commands are registry-driven (tool definitions declare which commands they expose).
	- Zoom/Pan commands control the viewport via a narrow imperative viewport API exposed by `MapEditorCanvas`.
	- Select commands (Delete/Clone) request main-process edits via `window.nomos.map.edit(...)` and update renderer selection based on the edit result.
- **Inspector** panel (right): contains collapsible sections, currently Asset Browser and Properties.
	- Asset Browser renders the current asset index entries and supports opening files via `window.nomos.assets.open(...)`.
		- Asset icons are color-coded by file type for readability on the dark surface.
	- Properties shows the selected map object and allows editing supported selection kinds.
		- Edits are committed via `window.nomos.map.edit(...)` using the `map-edit/update-fields` atomic command.
		- Walls, sectors, entities, and doors are editable via the Properties editor.
			- Door fields include `tex`, `starts_closed`, `required_item`, and `required_item_missing_message`.
	- On initial app open, Inspector starts at approximately 20% of the window width.

### Non-closable core panels
- The Map Editor and Inspector DockView panels are treated as “core” panels and are not closeable via the DockView tab UI.

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
- `mapGridSettings: MapGridSettings`
- `mapHistory: MapEditHistoryInfo`

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
