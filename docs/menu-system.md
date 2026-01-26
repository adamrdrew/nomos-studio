# Menu System

## Overview
Nomos Studio’s menu subsystem builds the Electron application menu template in a testable, platform-aware way.

Current responsibilities:
- Define the top-level menu structure (File + platform-specific Settings/Preferences entrypoint).
- Bind menu items to main-process callbacks (new/open/save/save-as, recent maps, refresh assets index, open settings).
- Bind Run menu items to main-process callbacks (Save & Run requested).
- Route File → Save and Run → Save & Run to the renderer as *requests* so the renderer can decide what the “active editor” is (map vs JSON tab).
- Enable/disable Save based on whether saving is possible in the current app state (map loaded or assets configured).
- Enable/disable Save & Run using the same coarse enablement gate as Save.
- Enable/disable Undo/Redo based on main-owned edit history state.
- Provide a View menu to switch map render mode and control map grid display.
- Provide View menu toggles that control Map Editor overlays (portal highlighting, textured door visibility).
- Provide a View menu toggle that highlights toggle walls (green).
- Provide a View menu control to choose which sector surface is displayed in textured mode (floor vs ceiling).

## Architecture

### Menu template factory (infrastructure)
- `src/main/infrastructure/menu/createApplicationMenuTemplate.ts`
	- Pure function returning `MenuItemConstructorOptions[]`.
	- Receives callbacks and state (`canSave`) as inputs.
	- Encodes platform-specific differences (macOS vs Windows/Linux).

### Wiring (main)
- `src/main/main.ts`
	- Computes `canSave` from whether either:
		- a map document is loaded (`store.getState().mapDocument !== null`), or
		- assets are configured (`store.getState().settings.assetsDirPath !== null`).
	- Computes `canUndo` / `canRedo` from `MapEditHistory.getInfo()`.
	- Reads `recentMapPaths` from `store.getState().recentMapPaths`.
	- Calls `Menu.setApplicationMenu(Menu.buildFromTemplate(template))`.
	- Subscribes to `AppStore` changes to re-install the menu when relevant state changes.
	- Implements Save/Save & Run as main→renderer requests (the renderer performs the actual save routing).

## Public API / entrypoints

### Programmatic API
- `createApplicationMenuTemplate(options: CreateApplicationMenuTemplateOptions): MenuItemConstructorOptions[]`

### User-facing entrypoints
- File menu:
	- New Map
	- Open Map…
	- Recent Maps (submenu)
	- Save (enabled only when `canSave` is true)
	- Save As…
	- Refresh Assets Index

- Edit menu:
	- Undo (enabled only when `canUndo` is true)
	- Redo (enabled only when `canRedo` is true)

- Run menu:
	- Save & Run (`F5`) (enabled only when `canSave` is true)

- View menu:
	- Wireframe
	- Textured
	- Floor Textures
	- Ceiling Textures
	- Highlight Portals
	- Highlight Toggle Walls
	- Toggle Door Visibility
	- Toggle Grid
	- Snap to Grid
	- Increase Grid Opacity
	- Decrease Grid Opacity

- Settings entrypoint:
	- macOS: App menu → Preferences… (`CommandOrControl+,`)
	- Windows/Linux: Settings menu → Settings… (`CommandOrControl+,`)

## Data shapes

`CreateApplicationMenuTemplateOptions`:
```ts
type CreateApplicationMenuTemplateOptions = Readonly<{
	appName: string;
	platform: NodeJS.Platform;
	canSave: boolean;
	canUndo: boolean;
	canRedo: boolean;
	recentMapPaths: readonly string[];
	mapRenderMode: MapRenderMode;
	mapGridSettings: MapGridSettings;
	mapHighlightPortals: boolean;
	mapHighlightToggleWalls: boolean;
	mapDoorVisibility: MapDoorVisibility;
	onOpenSettings: () => void;
	onNewMap: () => void;
	onOpenMap: () => void;
	onOpenRecentMap: (mapPath: string) => void;
	onSave: () => void;
	onSaveAs: () => void;
	onSaveAndRun?: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onRefreshAssetsIndex: () => void;
	onSetMapRenderMode: (mode: MapRenderMode) => void;
	onToggleMapHighlightPortals: () => void;
	onToggleMapHighlightToggleWalls: () => void;
	onToggleMapDoorVisibility: () => void;
	onToggleMapGrid: () => void;
	onToggleMapSnapToGrid: () => void;
	onIncreaseMapGridOpacity: () => void;
	onDecreaseMapGridOpacity: () => void;
	mapSectorSurface: MapSectorSurface;
	onSetMapSectorSurface: (surface: MapSectorSurface) => void;
}>;
```

## Boundaries & invariants

### Platform behavior
- macOS (`platform === 'darwin'`):
	- An application menu is created with the app name label.
	- Uses Preferences… as the idiomatic settings entrypoint.
- Non-macOS:
	- Preferences menu is not created.
	- Settings… lives under a Settings menu.

### Save enablement depends on store state
- `canSave` is derived from whether `AppStore` currently has either a loaded `mapDocument` or a configured `settings.assetsDirPath`.
- The main process re-installs the menu on store changes so Save enablement stays accurate.

### Save routing is renderer-owned
- Menu items **request** Save/Save & Run, but the renderer decides what to save based on the active editor tab.
- In editor mode, the renderer subscribes via preload and handles these requests in `EditorShell`.

### Grid menu items reflect store state
- The View menu includes a Toggle Grid checkbox whose checked state reflects `mapGridSettings.isGridVisible`.
- The View menu includes a Snap to Grid checkbox whose checked state reflects `mapGridSettings.isSnapToGridEnabled`.
- The Increase/Decrease Grid Opacity items adjust `mapGridSettings.gridOpacity` in bounded steps.

### Overlay menu items reflect store state
- The View menu includes a Highlight Portals checkbox whose checked state reflects `mapHighlightPortals`.
- The View menu includes a Highlight Toggle Walls checkbox whose checked state reflects `mapHighlightToggleWalls`.
- The View menu includes a Toggle Door Visibility checkbox whose checked state reflects whether `mapDoorVisibility === 'hidden'`.

### Sector surface menu items reflect store state
- The View menu includes a Floor/Ceiling radio pair whose selected value reflects `mapSectorSurface`.
- The floor/ceiling selection affects textured-mode sector fills only; wireframe rendering is unchanged.

## How to extend safely

### Adding a new menu item
- Prefer updating `createApplicationMenuTemplate` rather than building menus inline in `src/main/main.ts`.
- Keep menu callbacks minimal and delegate to application services.
- If the menu item needs enable/disable logic, thread it via the `CreateApplicationMenuTemplateOptions` (e.g., add `canExport`) and compute it from `AppStore`.

### Keeping tests stable
- The menu template factory should remain a pure function: no `app`, no `Menu` calls inside it.
- This keeps unit tests deterministic and avoids asserting Electron internals.

## Testing notes
- `src/main/infrastructure/menu/createApplicationMenuTemplate.test.ts` covers:
	- macOS Preferences entrypoint and accelerator
	- Windows/Linux Settings entrypoint and accelerator
	- Save enabled/disabled based on `canSave`
