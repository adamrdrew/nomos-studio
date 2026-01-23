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
		- Entities (right, tabbed with Inspector)
	- Refreshes the renderer snapshot on mount.
	- Subscribes to main→renderer state changes and refreshes automatically.
	- Core panels are non-closable and are re-created if removed.

- `src/renderer/ui/editor/panels/EntitiesDockPanel.tsx`
	- Entity browser panel.
	- Loads the entity manifest and entity defs from the assets directory via preload IPC.
	- Renders a thumbnail (first sprite frame) and entity name for each manifest entry.
	- Entity rows are draggable to place entities onto the map.

- `src/renderer/ui/editor/MapEditorCanvas.tsx`
	- Konva `Stage`/`Layer` based map viewport.
	- Renders:
		- wireframe walls + doors
		- textured floors + walls (best-effort)
		- textured ceilings (best-effort) when the View surface mode is set to ceiling
		- door/entity/light/particle markers
		- player start marker (circle + vision cone) when `player_start` is set
	- Implements Select-mode hit-testing and updates the selection state.
		- Picking is designed to follow the principle of least surprise: walls win over sectors when the pointer is visually on/near a wall.
		- If multiple sectors contain the pointer (nested sectors), the innermost/most-specific sector under the cursor is selected.
		- In textured mode, wall picking considers the rendered wall strip polygon so clicking inside the strip selects the wall (even when far from the centerline).
	- View overlays:
		- portal walls can be highlighted with a blue/cyan overlay (walls with `backSector > -1`)
		- toggle walls can be highlighted with a green overlay (walls with `toggle_sector === true`)
		- the active selection is outlined in red (wall/sector/door/entity/light/particle)
		- when the Select tool is active, the hovered object (what would be selected on click) is outlined in yellow
		- door markers can be hidden in textured mode via `mapDoorVisibility`
	- **Textured rendering + CSP constraints:**
		- The renderer requests texture bytes via `window.nomos.assets.readFileBytes({ relativePath })`.
		- Bytes are converted to an image by creating a `blob:` object URL and loading it into an `HTMLImageElement`.
		- The renderer CSP must allow `blob:` image URLs via `img-src`.
		- While textures are loading (or when a texture is missing), the viewer avoids large placeholder fills:
			- floors are not filled until the texture image is available
			- walls fall back to a wireframe segment until the wall texture image is available
		- Sector surface mode (textured fills):
			- A snapshot-driven view setting selects which sector surface is displayed: `mapSectorSurface: 'floor' | 'ceiling'`.
			- Floor mode uses `sector.floor_tex` for sector fills.
			- Ceiling mode uses `sector.ceil_tex` for sector fills.
			- Ceiling `SKY` (case-insensitive) substitutes the map-level `sky` texture (loaded from `Images/Sky/<file>`).
			- If a SKY ceiling cannot be resolved (missing/empty/unloadable `sky`), the renderer skips the sector fill rather than crashing.
		- Sector base lighting visualization (textured fills):
			- `sector.light` is treated as a scalar in `[0, 1]`.
			- The renderer draws a black overlay with opacity `1 - clamp01(sector.light)` over the sector texture fill.
			- Exception: SKY-derived ceiling fills render at full brightness (no darkening overlay).

### State management
Renderer state is intentionally small:

- `src/renderer/store/nomosStore.ts` (`useNomosStore`)
	- Zustand store that caches a snapshot of main state.
	- Populated by calling `refreshFromMain()` which invokes `window.nomos.state.getSnapshot()`.
	- Also stores renderer-local UI state:
		- `mapSelection` (selected map object identity)
		- `isPickingPlayerStart` (temporary “pick player start” interaction mode)
	- Includes snapshot fields used by UI enablement and rendering:
		- `mapGridSettings`
		- `mapHighlightPortals`
		- `mapHighlightToggleWalls`
		- `mapDoorVisibility`
		- `mapSectorSurface`
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
			- Textured walls use a world-space thickness (derived from the world-units-per-tile constant) so walls scale proportionally with sectors when zooming.
			- Textured wall geometry uses join-aware strip polygons so adjacent walls meet cleanly at corners.
				- Strips are **one-sided** per sector boundary loop: each wall renders from its centerline into the sector interior, so adjacent sectors sharing a boundary do not overlap each other in textured mode.
				- Default join is miter; a miter limit clamps extreme acute-angle joins (applied to the offset-side edge).
				- If a sector boundary loop is malformed (missing edges/vertices), rendering falls back to simple per-wall capped strips rather than crashing.
	- On map open, the view is initialized so the viewport center corresponds to world-space `(0,0)` and the map is framed to be visible immediately.
		- To achieve this for arbitrary authored coordinates, the renderer may apply a render-only origin offset derived from decoded map bounds; this does not mutate `MapDocument.json`.
	- The editor grid adapts its spacing to zoom so line density stays readable.
	- Grid visibility and opacity are controlled by main-process state (`mapGridSettings`) and updated via the View menu.
	- Portal highlighting and textured-mode door visibility are controlled by main-process snapshot state via the View menu.
	- Object markers (doors/entities/lights/particles) are sized in screen pixels and do not grow with zoom; light radius remains world-space.
	- The active selection is outlined in red to improve focus.
	- When the Select tool is active, a yellow hover outline previews what will be selected on click.
- **Toolbox** (left overlay within the Map Editor): Select / Move / Door / Room / Zoom / Pan tool modes.
	- Move mode allows dragging the currently selected entity or light to a new position.
		- The renderer maintains a local preview while dragging.
		- On mouse-up, the renderer commits a single main-process edit (`map-edit/move-entity` or `map-edit/move-light`) and clears the preview.
	- Door mode allows creating a door on a portal wall by clicking.
		- The cursor indicates validity:
			- `crosshair` over a portal wall with no existing door
			- `not-allowed` everywhere else
		- On a valid click, the renderer requests `map-edit/create-door` via `window.nomos.map.edit(...)`.
		- The created door is selected on success.
		- Doors are created without a default `tex`; the Inspector shows an explicit “(select texture)” placeholder state.
	- Room mode allows creating room geometry (sectors/walls/vertices) from a template by clicking.
		- The tool bar exposes template commands: Rectangle, Square, Triangle.
		- The command bar (top toolbar) shows a small hint on the upper-right with rotate/scale shortcuts.
		- A live outline preview tracks the mouse:
			- green when placement is valid (click would create a room)
			- red when invalid (click does nothing)
		- Validity is enforced (not advisory): rooms must be nested inside a sector or adjacent/snapped to an existing wall; intersections are rejected.
			- Exception: if the map has no sectors and no walls, the first room may be created as a “seed” room (not nested/adjacent).
		- On a valid click, the renderer requests `map-edit/create-room` via `window.nomos.map.edit(...)`.
		- Texture defaults are computed in the renderer from the current `assetIndex.entries`:
			- filter entries under `Images/Textures/`
			- sort lexicographically by relative path
			- take the first 3 filenames (prefix stripped) as `{ wallTex, floorTex, ceilTex }`
			- if fewer than 3 textures exist, room creation is blocked (invalid preview).
		- Key bindings while preview is visible:
			- primary modifier + left/right: rotate 90° (CCW/CW)
			- primary modifier + alt/option + arrows: scale along view axes in fixed steps
	- Buttons are icon-based with tooltips, fill the toolbox width, and do not stretch to fill the vertical space.
	- The toolbox is a compact, scrollable column so additional tools can be added without odd stretching.
	- Entity placement drag/drop:
		- The map canvas accepts drag payloads from the Entities panel.
		- While dragging an entity, the cursor indicates validity:
			- `copy` when the cursor world point is inside any sector
			- `not-allowed` everywhere else
		- Drops outside any sector are blocked (no map edit is issued).
		- On a valid drop, the renderer requests `map-edit/create-entity` and applies the returned selection effect.

- **Tool bar** (row above the Map Editor canvas): tool-specific commands for the currently selected tool.
	- Tool bar commands are registry-driven (tool definitions declare which commands they expose).
	- Zoom/Pan commands control the viewport via a narrow imperative viewport API exposed by `MapEditorCanvas`.
	- Zoom is clamped to a minimum and maximum view scale; the current maximum supports close inspection (max scale 64).
	- Select commands (Delete/Clone) request main-process edits via `window.nomos.map.edit(...)` and update renderer selection based on the edit result.
- **Inspector** panel (right): contains collapsible sections, currently Asset Browser, Object Properties, and Map Properties.
	- Asset Browser renders the current asset index entries and supports opening files via a small double-click router:
		- `Levels/*.json` opens the map in-editor via `window.nomos.map.openFromAssets({ relativePath })`.
		- all other assets open via `window.nomos.assets.open({ relativePath })`.
		- Asset icons are color-coded by file type for readability on the dark surface.
	- Object Properties shows the selected map object and allows editing supported selection kinds.
		- Edits are committed via `window.nomos.map.edit(...)` using the `map-edit/update-fields` atomic command.
		- Walls, sectors, entities, and doors are editable via the Properties editor.
			- Door fields include `tex`, `starts_closed`, `required_item`, and `required_item_missing_message`.
			- Sector fields include `light`.
				- The UI communicates `light` as a 0..1 scalar and clamps out-of-range inputs to `[0, 1]` on commit.
			- Sector fields include a **Texture Walls** control (dropdown + Set button).
				- The dropdown is populated from textures indexed under `Images/Textures/` (fallback `Assets/Images/Textures/`) and uses basenames.
				- Changing the dropdown does not commit; clicking **Set** commits a single `map-edit/set-sector-wall-tex` edit.
				- “Surrounding walls” are defined as walls where `wall.front_sector === sectorId` (no cross-boundary painting).
			- Wall fields include toggle authoring:
				- `toggle_sector` (checkbox)
				- When enabled, the UI exposes `toggle_sector_id` (dropdown + eye-dropper pick mode), `toggle_sector_oneshot`, `toggle_sound`, and `toggle_sound_finish`.
			- Sector fields include `floor_z_toggled_pos` (dropdown -10..10, optional).
	- On initial app open, Inspector starts at approximately 20% of the window width.

- **Map Properties** section (within Inspector): edits map-level fields on the map JSON root.
	- Controls:
		- `bgmusic` (dropdown from `Sounds/MIDI/`, stored as basename)
		- `soundfont` (dropdown from `Sounds/SoundFonts/`, stored as basename)
		- `sky` (dropdown from `Images/Sky/`, stored as basename)
		- `name` (text input)
		- `player_start` (X/Y/Angle inputs plus a Pick/Cancel button)
	- Edits commit via `window.nomos.map.edit(...)` using `map-edit/update-fields` with `target: { kind: 'map' }`.
	- `player_start` commits via `map-edit/set-player-start` (because update-fields rejects objects).
		- Pick mode sets `(x,y)` by interpreting the next click on the map canvas.
		- Angle is edited in degrees and stored as `angle_deg`.
		- The X/Y/Angle inputs accept numeric values only; invalid non-empty input shows an error and does not commit.

### Non-closable core panels
- The Map Editor, Inspector, and Entities DockView panels are treated as “core” panels and are not closeable via the DockView tab UI.

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
- `mapHighlightPortals: boolean`
- `mapHighlightToggleWalls: boolean`
- `mapDoorVisibility: MapDoorVisibility`
- `mapSectorSurface: 'floor' | 'ceiling'`
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
