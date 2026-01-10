# Renderer UI System

## Overview
The renderer UI subsystem contains the React UI that runs in Electron renderer processes.

Current responsibilities:
- Render the main “editor shell” UI (currently a bootstrap shell).
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
	- Contains the Settings UI (`SettingsPanel`) and the bootstrap shell UI.

### State management
There are two stores in the renderer:

- `src/renderer/store/nomosStore.ts` (`useNomosStore`)
	- Zustand store that caches a snapshot of main state.
	- Populated by calling `refreshFromMain()` which invokes `window.nomos.state.getSnapshot()`.

- Local UI state store inside `renderer.tsx` (`useAppStore`)
	- Holds UI-only state such as click count and whether the Settings dialog is open.

### Preload/IPC integration
Renderer code calls the typed preload surface `window.nomos.*` for privileged operations:
- Settings read/write: `window.nomos.settings.get()` and `window.nomos.settings.update(...)`
- File/directory dialogs: `window.nomos.dialogs.*`
- Map operations: `window.nomos.map.*`
- State snapshot: `window.nomos.state.getSnapshot()`

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

## Boundaries & invariants

### Security boundary (L03)
- Renderer must not access Node or OS APIs directly.
- All privileged operations must go through the preload/IPC API (`window.nomos`).

### Settings mode behavior
- When in settings mode:
	- The root UI renders only the Settings panel.
	- “Done” and “Cancel” close the window.

### State freshness
- Renderer state is pull-based.
- After performing main-process actions that change state (e.g., open map, refresh assets), the renderer must refresh from main if it needs the latest snapshot.

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
