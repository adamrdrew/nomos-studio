# Maps System

## Overview
Nomos Studio currently supports opening, validating, and saving map files (JSON) via main-process application services. Validation is performed by invoking an external “game executable” (configured in settings) with a `--validate-map` command.

The current map model is intentionally minimal:
- A map is a JSON file loaded into memory as `unknown`.
- The app tracks the current open document (file path, JSON payload, dirty flag, and last validation record).

## Architecture
The maps system spans application services, infrastructure seams for filesystem/process execution, and a small preload/IPC API.

- **Shared domain types**
	- `MapDocument` and `MapValidationRecord` live in `src/shared/domain/models.ts`.
	- `MapIoError` and `MapValidationError` live in `src/shared/domain/results.ts`.

- **Application layer (main process, orchestration)**
	- `MapValidationService` validates a map path by running the configured game executable.
	- `OpenMapService` enforces prerequisite settings, validates the map, reads JSON from disk, constructs a `MapDocument`, and stores it in `AppStore`.
	- `SaveMapService` serializes the current `MapDocument.json` and performs a safe write back to disk.
	- `UserNotifier` is injected so user-visible errors can be shown without binding services directly to Electron UI.

- **Infrastructure seams (side effects)**
	- File I/O is performed via the injected `FileSystem` adapter (`src/main/infrastructure/settings/fileSystem.ts`).
	- Process execution is performed via `ProcessRunner` (`src/main/infrastructure/process/ProcessRunner.ts`) with `nodeProcessRunner` as the production implementation.

- **IPC / preload surface**
	- The renderer triggers map operations via `window.nomos.map.*` and `window.nomos.dialogs.openMap()`.
	- Main process handlers delegate to the application services.

## Public API / entrypoints

### Application APIs (main)
- `MapValidationService`
	- `validateMap(mapPath: string): Promise<Result<MapValidationRecord, MapValidationError>>`

- `OpenMapService`
	- `openMap(mapPath: string): Promise<Result<MapDocument, MapIoError | MapValidationError>>`

- `SaveMapService`
	- `saveCurrentDocument(): Promise<Result<MapDocument, MapIoError>>`

### Preload API (renderer-facing)
- `window.nomos.dialogs.openMap(): Promise<OpenMapDialogResponse>`
- `window.nomos.map.validate(request: { mapPath: string }): Promise<ValidateMapResponse>`
- `window.nomos.map.open(request: { mapPath: string }): Promise<OpenMapResponse>`
- `window.nomos.map.save(): Promise<SaveMapResponse>`

### IPC contract
Defined in `src/shared/ipc/nomosIpc.ts`:
- Channels:
	- `nomos:dialogs:open-map`
	- `nomos:map:validate`
	- `nomos:map:open`
	- `nomos:map:save`

Types:
- `OpenMapDialogResponse = Result<string | null, { message: string }>`
- `ValidateMapRequest = Readonly<{ mapPath: string }>`
- `ValidateMapResponse = Result<null, MapValidationError>`
- `OpenMapRequest = Readonly<{ mapPath: string }>`
- `OpenMapResponse = Result<MapDocument, MapIoError | MapValidationError>`
- `SaveMapResponse = Result<MapDocument, MapIoError>`

## Data shapes

### In-memory types
`MapDocument`:
```ts
type MapDocument = Readonly<{
	filePath: string;
	json: unknown;
	dirty: boolean;
	lastValidation: MapValidationRecord | null;
}>;
```

`MapValidationRecord`:
```ts
type MapValidationRecord =
	| Readonly<{ ok: true; validatedAtIso: string }>
	| Readonly<{ ok: false; validatedAtIso: string; reportText: string }>;
```

`MapIoError`:
```ts
type MapIoError = Readonly<{
	kind: 'map-io-error';
	code:
		| 'map-io/open-cancelled'
		| 'map-io/read-failed'
		| 'map-io/parse-failed'
		| 'map-io/no-document'
		| 'map-io/write-failed';
	message: string;
}>;
```

`MapValidationError`:
```ts
type MapValidationError = Readonly<{
	kind: 'map-validation-error';
	code:
		| 'map-validation/missing-settings'
		| 'map-validation/runner-failed'
		| 'map-validation/invalid-map';
	message: string;
	report?: Readonly<{
		kind: 'map-validation-error-report';
		prettyText: string;
		rawText: string;
	}>;
}>;
```

### On-disk format
- Map files are JSON documents stored on disk.
- `OpenMapService` reads file bytes and parses JSON into `unknown` (no schema enforcement yet in the app; validation is delegated to the external validator).

## Boundaries & invariants

### Security boundary (L03)
- Filesystem and process execution are main-process-only.
- Renderer uses preload/IPC to request operations.

### Prerequisite settings
- Opening a map requires both:
	- `EditorSettings.assetsDirPath` (assets directory)
	- `EditorSettings.gameExecutablePath` (validator executable)
- If either is missing, `OpenMapService.openMap`:
	- notifies the user (via `UserNotifier.showError`)
	- returns `MapValidationError` with `code: 'map-validation/missing-settings'`

### Validation contract
- `MapValidationService` runs: `<gameExecutablePath> --validate-map <absoluteMapPath>`.
- Validation is based on process exit code:
	- `exitCode === 0` => ok
	- any other exit code => invalid map
- Validation report extraction:
	- prefers `stdout` if non-empty, otherwise uses `stderr`
	- attempts JSON parse to pretty-print; otherwise uses raw text

### Open behavior
- A map is validated before being read and parsed.
- When open succeeds, `AppStore.mapDocument` is set with `dirty: false` and `lastValidation` set to the validation record.

### Save behavior (L06)
- Save writes to `<file>.tmp` and then atomically replaces the destination using a Windows-safe rename strategy.
- On success, the stored document is updated with `dirty: false`.

## How to extend safely

### Adding stronger map typing
- Keep `MapDocument.json` as `unknown` until there is a stable schema/type system.
- Prefer introducing a validated/typed domain representation *after* validation succeeds (e.g., parse+validate into a typed structure), and keep raw JSON for round-tripping if needed.

### Evolving validation
- Keep validation behind `ProcessRunner` so tests remain deterministic.
- If validation needs richer output (structured diagnostics), extend `MapValidationErrorReport` and keep parsing rules explicit.

### Editing and dirty tracking
- If introducing edits in the renderer, keep the source of truth and dirty/validation transitions explicit.
- When changing save semantics, preserve safe-write behavior and avoid destructive operations.

## Testing notes
Existing unit tests cover core branches:
- `src/main/application/maps/MapValidationService.test.ts`
- `src/main/application/maps/OpenMapService.test.ts`
- `src/main/application/maps/SaveMapService.test.ts`

Test seams:
- `MapValidationService` depends on `ProcessRunner` + injected `nowIso`.
- `OpenMapService` depends on `FileSystem` and `UserNotifier`.
- `SaveMapService` depends on `FileSystem` and `UserNotifier`.
