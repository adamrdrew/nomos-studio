# Maps System

## Overview
Nomos Studio currently supports opening, validating, and saving map files (JSON) via main-process application services. Validation is performed by invoking an external “game executable” (configured in settings) with a `--validate-map` command.

For the map editing/undo/redo design and its transactional command model, see:
- `docs/map-edit-command-system.md`

The current map model is intentionally minimal:
- A map is a JSON file loaded into memory as `unknown`.
- The app tracks the current open document (file path, JSON payload, dirty flag, last validation record, and a monotonic `revision` used for stale-edit protection).

Renderer-side rendering/hit-testing builds a typed view model from `MapDocument.json` after validation succeeds, but `MapDocument.json` remains `unknown` within the maps subsystem to preserve round-tripping.

## Architecture
The maps system spans application services, infrastructure seams for filesystem/process execution, and a small preload/IPC API.

- **Shared domain types**
	- `MapDocument` and `MapValidationRecord` live in `src/shared/domain/models.ts`.
	- `MapIoError` and `MapValidationError` live in `src/shared/domain/results.ts`.

- **Application layer (main process, orchestration)**
	- `MapValidationService` validates a map path by running the configured game executable.
	- `OpenMapService` enforces prerequisite settings, validates the map, reads JSON from disk, constructs a `MapDocument`, and stores it in `AppStore`.
	- `SaveMapService` serializes the current `MapDocument.json` and performs a safe write back to disk.
	- `MapEditService` applies a narrow set of in-memory edits (Delete/Clone/Move Entity) to `MapDocument.json` and marks the document dirty.
	- `MapCommandEngine` applies map edit commands (including transactional batches) against a working clone of `MapDocument.json` and returns explicit selection effects.
	- `MapEditHistory` stores bounded undo/redo stacks for the currently-open map.
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

- `MapEditService`
	- `edit(request: MapEditRequest): Result<MapEditResult, MapEditError>`
	- `edit(command: MapEditCommand): Result<MapEditResult, MapEditError>`
	- `undo(request: MapUndoRequest): Result<MapEditResult, MapEditError>`
	- `undo(request?: { steps?: number }): Result<MapEditResult, MapEditError>`
	- `redo(request: MapRedoRequest): Result<MapEditResult, MapEditError>`
	- `redo(request?: { steps?: number }): Result<MapEditResult, MapEditError>`

### Preload API (renderer-facing)
- `window.nomos.dialogs.openMap(): Promise<OpenMapDialogResponse>`
- `window.nomos.map.validate(request: { mapPath: string }): Promise<ValidateMapResponse>`
- `window.nomos.map.open(request: { mapPath: string }): Promise<OpenMapResponse>`
- `window.nomos.map.save(): Promise<SaveMapResponse>`
- `window.nomos.map.edit(request: MapEditRequest): Promise<MapEditResponse>`
- `window.nomos.map.undo(request: MapUndoRequest): Promise<MapUndoResponse>`
- `window.nomos.map.redo(request: MapRedoRequest): Promise<MapRedoResponse>`

### IPC contract
Defined in `src/shared/ipc/nomosIpc.ts`:
- Channels:
	- `nomos:dialogs:open-map`
	- `nomos:map:validate`
	- `nomos:map:open`
	- `nomos:map:save`
	- `nomos:map:edit`
	- `nomos:map:undo`
	- `nomos:map:redo`

Types:
- `OpenMapDialogResponse = Result<string | null, { message: string }>`
- `ValidateMapRequest = Readonly<{ mapPath: string }>`
- `ValidateMapResponse = Result<null, MapValidationError>`
- `OpenMapRequest = Readonly<{ mapPath: string }>`
- `OpenMapResponse = Result<MapDocument, MapIoError | MapValidationError>`
- `SaveMapResponse = Result<MapDocument, MapIoError>`

Edit map:
- `MapEditRequest = Readonly<{ baseRevision: number; command: MapEditCommand }>`
- `MapEditResponse = Result<MapEditResult, MapEditError>`

## Data shapes

### In-memory types
`MapDocument`:
```ts
type MapDocument = Readonly<{
	filePath: string;
	json: unknown;
	dirty: boolean;
	lastValidation: MapValidationRecord | null;
	revision: number;
}>;
```

`revision` semantics:
- Set to `1` when a map is successfully opened.
- Bumped by `+1` on every successful edit/undo/redo.
- Save does not bump `revision`.

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

If validation fails with `code: 'map-validation/invalid-map'`:
- the map is not loaded
- an error dialog is shown with title and message exactly `Map validation failed`
- the dialog detail contains the validator report pretty text (JSON pretty print when parseable; otherwise raw text)

### Save behavior (L06)
- Save writes to `<file>.tmp` and then atomically replaces the destination using a Windows-safe rename strategy.
- On success, the stored document is updated with `dirty: false`.

### Edit behavior (atomic + transactional)
- Edits are applied only to the in-memory `MapDocument.json` and stored via a single `AppStore.setMapDocument` on success.
- Transactions (`map-edit/transaction`) are applied atomically: all steps succeed, or no store mutation occurs.
- On any successful edit:
	- `dirty` is set to `true`.
	- `lastValidation` is cleared to `null` (edits invalidate prior validation results).
- Edits do not touch the filesystem directly.

### Selection reconciliation
- The renderer must not “guess” selection validity by inspecting `MapDocument.json`.
- Instead, selection changes are driven by explicit `MapEditSelectionEffect` values produced in main:
	- Transaction edits return `MapEditResult.kind: 'map-edit/applied'` with `selection`.
	- Undo/redo returns `MapEditResult.kind: 'map-edit/applied'` with `selection`.
- For main-triggered operations (e.g., menu Undo/Redo), main may include `selectionEffect` in the `nomos:state:changed` event payload so the renderer can reconcile selection deterministically.

### Undo/redo semantics
- Undo/redo is owned by the main process and restores the prior in-memory document **exactly** (round-trip safe):
	- `json` is restored exactly to the prior value.
	- `dirty` is restored exactly.
	- `lastValidation` is restored exactly.
- Opening a map clears undo/redo history for the prior document.
- Saving a map does **not** clear undo/redo history. (History is an in-memory editing affordance; its lifecycle is tied to the currently-open document, not persistence.)

### Stale-edit protection
- Renderer-initiated edit-like operations (edit/undo/redo) must include `baseRevision` matching the latest snapshot’s `mapDocument.revision`.
- Main rejects mismatches with `map-edit/stale-revision` including `currentRevision` and performs no partial mutation.

### History enablement
- Main exposes `mapHistory` (undo/redo availability + depths) via the state snapshot so UI can enable/disable commands without additional IPC.

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
