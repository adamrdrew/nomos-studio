# Settings System

## Overview
Nomos Studio persists a small set of app-level settings (currently: assets directory path and game executable path) to a JSON file under Electron’s `app.getPath('userData')`. Settings are loaded in the main process at startup and are exposed to the renderer via a minimal preload API (`window.nomos.settings`).

The settings system is designed to be **extensible and forward-compatible**:
- The on-disk JSON format is versioned.
- Unknown keys in the settings file are preserved when saving updates to known settings.

## Architecture
The settings implementation is split across the standard boundaries:

- **Shared domain types**
	- `EditorSettings` and `SettingsError` live under `src/shared/domain/` and are used across main/preload/renderer.

- **Application layer (main process, orchestration)**
	- `SettingsService` is the main application-level API for reading and updating settings.
	- It depends on an injected `SettingsRepository` interface.

- **Infrastructure layer (persistence and side effects)**
	- `JsonFileSettingsRepository` implements `SettingsRepository` using an injected `FileSystem` adapter.
	- `settingsCodec` owns JSON decode/encode rules including version parsing and unknown-field preservation.
	- Writes are done via a tmp-file + rename strategy with a Windows-safe fallback.

- **Main process composition/root**
	- `src/main/main.ts` wires the real implementations:
		- `userDataDirPath: app.getPath('userData')`
		- `fs: nodeFileSystem`
	- After initial load, the `AppStore` is updated with settings and (if an assets dir is set) the asset index is refreshed.

- **Renderer UI surface**
	- The Settings UI runs in a dedicated Settings window (`createSettingsWindow`) which loads the same renderer bundle, but in “settings mode” using the `nomosSettings=1` query param.
	- The settings panel reads settings via `window.nomos.settings.get()` and saves via `window.nomos.settings.update(...)`.

## Public API / entrypoints

### Application API (main)
- `SettingsService`
	- `getSettings(): Promise<Result<EditorSettings, SettingsError>>`
	- `updateSettings(updates: Partial<EditorSettings>): Promise<Result<EditorSettings, SettingsError>>`

### Persistence API (main)
- `SettingsRepository` (interface)
	- `loadSettings(): Promise<Result<EditorSettings, SettingsError>>`
	- `saveSettings(settings: EditorSettings): Promise<Result<void, SettingsError>>`

- `JsonFileSettingsRepository` (implementation)
	- `loadSettings()` returns defaults when the settings file does not exist.
	- `saveSettings(settings)` writes JSON to `nomos-settings.json` under `userData`, preserving unknown keys from an existing file when possible.

### Preload API (renderer-facing)
Exposed on `window.nomos.settings` from `src/preload/preload.ts`:
- `get(): Promise<SettingsGetResponse>`
- `update(updates: SettingsUpdateRequest): Promise<SettingsUpdateResponse>`

### IPC contract (typed)
Defined in `src/shared/ipc/nomosIpc.ts`:
- Channels:
	- `nomos:settings:get`
	- `nomos:settings:update`
- Types:
	- `SettingsGetResponse = Result<EditorSettings, SettingsError>`
	- `SettingsUpdateRequest = Partial<EditorSettings>`
	- `SettingsUpdateResponse = Result<EditorSettings, SettingsError>`

### UI entrypoints
- Settings window:
	- `createSettingsWindow()` creates a `BrowserWindow` and loads the renderer URL with `?nomosSettings=1`.
- Renderer settings mode:
	- `isSettingsMode()` checks `window.location.search` and `window.location.hash` for `nomosSettings=1|true`.
	- `SettingsPanel` reads and updates settings via `window.nomos.settings`.

## Data shapes

### In-memory types
`EditorSettings` (shared domain):
```ts
type EditorSettings = Readonly<{
	assetsDirPath: string | null;
	gameExecutablePath: string | null;
}>;
```

`SettingsError` (shared domain):
```ts
type SettingsError = Readonly<{
	kind: 'settings-error';
	code: 'settings/read-failed' | 'settings/write-failed' | 'settings/parse-failed';
	message: string;
}>;
```

### On-disk JSON
The canonical description of the file shape lives in `src/main/infrastructure/settings/settingsFileFormat.md`.

Current versioned shape (written as pretty JSON):
```json
{
	"version": 1,
	"assetsDirPath": null,
	"gameExecutablePath": null
}
```

Forward compatibility:
- Any additional top-level keys are treated as “unknown fields” and must be preserved when the app saves updates.

Backward compatibility:
- Legacy/unversioned files (missing `version`) are accepted; the codec treats them as legacy and saving writes a versioned object.

### Renderer-to-main updates
`SettingsUpdateRequest` is `Partial<EditorSettings>`.

Important semantics:
- “Not provided” (`undefined`) means “do not change this field”.
- `null` means “explicitly clear this field”.

## Boundaries & invariants

### Security boundary (L03)
- Renderer code must not perform filesystem I/O.
- The renderer can only interact with settings via the preload API and typed IPC channels.

### Persistence behavior and safety (L05/L06)
- Reads:
	- If `nomos-settings.json` does not exist (`ENOENT`), the repository returns default settings (`null` values) rather than failing.
	- If the file exists but contains invalid JSON or a non-object top-level value, decoding fails with `settings/parse-failed`.

- Writes:
	- Writes are performed by writing to `<file>.tmp` then renaming into place.
	- On platforms where renaming over an existing file fails (Windows-style behavior), the implementation moves the existing file to a `.bak` (or `.bak.N`) path, then retries.
	- Best-effort cleanup attempts to remove tmp and backup files; cleanup failure does not crash the app.

### Extensibility / unknown-key preservation
- `settingsCodec` extracts `unknownFields` as all top-level keys other than `version`, `assetsDirPath`, and `gameExecutablePath`.
- `JsonFileSettingsRepository.saveSettings` attempts to read an existing file and preserve those `unknownFields` during the next write.
- If reading/parsing the existing file fails, saving still proceeds but unknown-key preservation cannot be guaranteed for that write.

### Startup wiring behavior
- On app ready, settings are loaded and stored in `AppStore`.
- When settings are updated via IPC:
	- `AppStore` is updated.
	- If `assetsDirPath` changes from one non-null path to another, the asset index is refreshed.

## How to extend safely

### Adding a new setting field
1. Add the field to `EditorSettings` in `src/shared/domain/models.ts`.
2. Update `settingsCodec`:
	 - decode the field from the JSON object
	 - include it in `encodeSettingsFile`
	 - ensure unknown-field preservation still excludes only known keys
3. Update `settingsFileFormat.md` to reflect the new known key and its type.
4. Update `SettingsService.updateSettings` to merge `Partial<EditorSettings>` correctly:
	 - treat `undefined` as “no change”
	 - accept `null` if “clear” is valid for that field
5. Update renderer UI only if the setting needs a user-facing control.
6. Update tests for all new conditional paths.

### Changing the on-disk format
- Prefer additive changes (new optional keys) to avoid migrations.
- If a breaking change is unavoidable:
	- bump `SETTINGS_FILE_VERSION`
	- define how legacy versions are decoded
	- keep unknown-key preservation rules explicit

## Testing notes
Existing tests cover the public surface area and key branches:
- `src/main/application/settings/SettingsService.test.ts`
- `src/main/infrastructure/settings/settingsCodec.test.ts`
- `src/main/infrastructure/settings/JsonFileSettingsRepository.test.ts`
- `src/main/infrastructure/settings/nodeFileSystem.test.ts`

The infrastructure layer is designed for testability:
- `JsonFileSettingsRepository` depends on a `FileSystem` interface so tests can use stubs/fakes.
- `settingsCodec` is pure and can be unit tested without Electron or filesystem dependencies.
