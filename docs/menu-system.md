# Menu System

## Overview
Nomos Studio’s menu subsystem builds the Electron application menu template in a testable, platform-aware way.

Current responsibilities:
- Define the top-level menu structure (File + platform-specific Settings/Preferences entrypoint).
- Bind menu items to main-process callbacks (open map, save, refresh assets index, open settings).
- Enable/disable Save based on whether a map document is currently loaded.
- Enable/disable Undo/Redo based on main-owned edit history state.
- Provide a View menu to switch map render mode and control map grid display.
- Provide View menu toggles that control Map Editor overlays (portal highlighting, textured door visibility).

## Architecture

### Menu template factory (infrastructure)
- `src/main/infrastructure/menu/createApplicationMenuTemplate.ts`
	- Pure function returning `MenuItemConstructorOptions[]`.
	- Receives callbacks and state (`canSave`) as inputs.
	- Encodes platform-specific differences (macOS vs Windows/Linux).

### Wiring (main)
- `src/main/main.ts`
	- Computes `canSave` from `store.getState().mapDocument !== null`.
	- Computes `canUndo` / `canRedo` from `MapEditHistory.getInfo()`.
	- Calls `Menu.setApplicationMenu(Menu.buildFromTemplate(template))`.
	- Subscribes to `AppStore` changes to re-install the menu when relevant state changes.

## Public API / entrypoints

### Programmatic API
- `createApplicationMenuTemplate(options: CreateApplicationMenuTemplateOptions): MenuItemConstructorOptions[]`

### User-facing entrypoints
- File menu:
	- Open Map…
	- Save (enabled only when `canSave` is true)
	- Refresh Assets Index

- Edit menu:
	- Undo (enabled only when `canUndo` is true)
	- Redo (enabled only when `canRedo` is true)

- View menu:
	- Wireframe
	- Textured
	- Highlight Portals
	- Toggle Door Visibility
	- Toggle Grid
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
	mapRenderMode: MapRenderMode;
	mapGridSettings: MapGridSettings;
	mapHighlightPortals: boolean;
	mapDoorVisibility: MapDoorVisibility;
	onOpenSettings: () => void;
	onOpenMap: () => void;
	onSave: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onRefreshAssetsIndex: () => void;
	onSetMapRenderMode: (mode: MapRenderMode) => void;
	onToggleMapHighlightPortals: () => void;
	onToggleMapDoorVisibility: () => void;
	onToggleMapGrid: () => void;
	onIncreaseMapGridOpacity: () => void;
	onDecreaseMapGridOpacity: () => void;
}>;
```

## Boundaries & invariants

### Platform behavior
- macOS (`platform === 'darwin'`):
	- An application menu is created with the app name label.
	- Uses Preferences… as the idiomatic settings entrypoint.
- Non-macOS:
	- Preferences menu is not created.
	- Settings… lives under an Edit menu.

### Save enablement depends on store state
- `canSave` is derived from whether `AppStore` currently has a `mapDocument`.
- The main process re-installs the menu on store changes so Save enablement stays accurate.

### Grid menu items reflect store state
- The View menu includes a Toggle Grid checkbox whose checked state reflects `mapGridSettings.isGridVisible`.
- The Increase/Decrease Grid Opacity items adjust `mapGridSettings.gridOpacity` in bounded steps.

### Overlay menu items reflect store state
- The View menu includes a Highlight Portals checkbox whose checked state reflects `mapHighlightPortals`.
- The View menu includes a Toggle Door Visibility checkbox whose checked state reflects whether `mapDoorVisibility === 'hidden'`.

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
