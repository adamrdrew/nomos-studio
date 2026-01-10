# Windowing System

## Overview
Nomos Studio’s windowing subsystem is responsible for creating and managing Electron `BrowserWindow` instances.

Current windows:
- **Main window**: the primary editor shell.
- **Settings window**: a small, non-resizable window that renders the same renderer bundle in “settings mode”.

The subsystem emphasizes Electron security best practices (L03): renderer windows run with `contextIsolation: true`, `sandbox: true`, and no Node integration.

## Architecture

### Window factories
- `src/main/windows/createMainWindow.ts`
	- Creates the main `BrowserWindow`.
	- Loads `MAIN_WINDOW_WEBPACK_ENTRY` (Forge/Webpack entry).
	- Shows the window on `ready-to-show`.

- `src/main/windows/createSettingsWindow.ts`
	- Creates a secondary `BrowserWindow` configured for Settings.
	- Loads the same `MAIN_WINDOW_WEBPACK_ENTRY` but appends `?nomosSettings=1`.
	- Shows and focuses the window on `ready-to-show`.

### Shared webPreferences
- `src/main/windows/createMainWindowWebPreferences.ts`
	- Defines the security posture for all renderer windows.
	- `createMainWindowWebPreferencesForForgeEnvironment()` wires Forge’s preload path constant and derives `isDev` from `NODE_ENV`.

### Lifecycle ownership
- `src/main/main.ts` owns the singleton window references:
	- `mainWindow: BrowserWindow | null`
	- `settingsWindow: BrowserWindow | null`
- Each is created “once ready” and cleared on `'closed'`.

## Public API / entrypoints

### Main-process APIs
- `createMainWindow(): Promise<BrowserWindow>`
- `createSettingsWindow(): Promise<BrowserWindow>`
- `createMainWindowWebPreferences(deps): WebPreferences`
- `createMainWindowWebPreferencesForForgeEnvironment(): WebPreferences`

### Renderer routing entrypoint
- Settings mode is selected by query-string flag:
	- `nomosSettings=1` (or `true`)

Renderer code reads this in `src/renderer/renderer.tsx` (see `isSettingsMode()`) and renders a settings-only view when enabled.

## Data shapes

### WebPreferences
`createMainWindowWebPreferences` returns a standard Electron `WebPreferences` object:
```ts
type MainWindowWebPreferencesDependencies = {
	preloadPath: string;
	isDev: boolean;
};
```

Key values (security-critical):
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `devTools: isDev`

## Boundaries & invariants

### Security boundary (L03)
- Renderer windows must not have Node integration.
- Privileged operations must be accessed through preload/IPC only.

### Shared renderer bundle
- Both windows load the same renderer entrypoint (`MAIN_WINDOW_WEBPACK_ENTRY`).
- Settings window toggles “settings mode” via `nomosSettings=1`.

### Window UX constraints
- Settings window is non-resizable and cannot be maximized/minimized (current behavior), to keep the UI focused and predictable.

### Show timing
- Windows are initially created with `show: false` and then shown on `'ready-to-show'` to avoid visual flashes.

## How to extend safely

### Adding a new window
- Create a new factory under `src/main/windows/` similar to `createMainWindow` / `createSettingsWindow`.
- Use `createMainWindowWebPreferencesForForgeEnvironment()` unless there is a compelling, documented reason not to.
- Prefer passing routing via URL query params over building a new renderer bundle.

### Maintaining security posture
- Do not change `contextIsolation`, `sandbox`, or `nodeIntegration` unless the project laws are explicitly amended.
- Avoid enabling any kind of remote content loading as app code.

### Wiring lifecycle
- Keep window ownership centralized in `src/main/main.ts` (singletons) unless multi-window behavior is explicitly designed.

## Testing notes
- `src/main/windows/createMainWindow.test.ts` covers main window construction and load behavior.
- `src/main/windows/createMainWindowWebPreferences.test.ts` covers dev/prod conditionals and the security settings.
- `src/main/windows/createSettingsWindow.test.ts` covers:
	- BrowserWindow options
	- URL rewriting (`nomosSettings=1` appended correctly)
	- ready-to-show behavior (show + focus)
