# Shared Domain System

## Overview
The shared domain subsystem defines cross-cutting, framework-agnostic types used by both main and renderer code (and by IPC payloads). It is the common vocabulary for:
- persisted/editor settings
- asset index structures
- map document and validation record shapes
- typed error/result patterns

Keeping these types in `src/shared/domain` avoids drift between main/renderer and keeps IPC payloads consistent.

## Architecture

### Core files
- `src/shared/domain/models.ts`
	- Domain data shapes shared across layers.

- `src/shared/domain/results.ts`
	- `Result<Ok, Err>` discriminated union.
	- Typed error shapes for settings, assets, and maps.

- `src/shared/domain/asyncSignal.ts`
	- A small async synchronization primitive.
	- Currently not used by production code, but has unit tests.

## Public API / entrypoints

### Exported types
- `EditorSettings`
- `AssetIndexStats`, `AssetIndex`
- `MapDocument`, `MapValidationRecord`

### Result and errors
- `Result<Ok, Err>`
- `SettingsError`
- `AssetIndexError`
- `MapIoError`
- `MapValidationError` and `MapValidationErrorReport`

### Utility
- `AsyncSignal`

## Data shapes

### Result envelope
```ts
type Result<Ok, Err> =
	| Readonly<{ ok: true; value: Ok }>
	| Readonly<{ ok: false; error: Err }>;
```

### Settings
```ts
type EditorSettings = Readonly<{
	assetsDirPath: string | null;
	gameExecutablePath: string | null;
}>;
```

### Assets
```ts
type AssetIndex = Readonly<{
	baseDir: string;
	entries: readonly string[];
	stats: Readonly<{ fileCount: number }>;
	builtAtIso: string;
}>;
```

### Maps
```ts
type MapDocumentRevision = number;

type MapDocument = Readonly<{
	filePath: string;
	json: unknown;
	dirty: boolean;
	lastValidation: MapValidationRecord | null;
	revision: MapDocumentRevision;
}>;
```

Errors follow a consistent pattern:
- a stable `kind` discriminator
- a narrower `code` discriminator for branching
- a user-actionable `message`

## Boundaries & invariants

### No framework/runtime dependencies
- `src/shared/domain` should remain free of Electron, filesystem, and process APIs.
- This keeps types reusable across main/preload/renderer and easy to test.

### Prefer `unknown` over `any`
- Map JSON is currently modeled as `unknown` to avoid leaking assumptions about schema.
- Narrowing/validation should happen in application services.

### Discriminated unions for branching
- Callers should branch on `result.ok` and on error `kind` / `code` rather than parsing error message strings.

## How to extend safely

### Adding new shared models
- Add new types to `models.ts` when:
	- both main and renderer need the shape, or
	- the shape is part of an IPC payload.
- Keep models serializable if they are used across IPC.

### Adding new errors
- Prefer adding a new discriminated union in `results.ts`.
- Keep `kind` stable and descriptive; use `code` for specific branch handling.
- Avoid embedding non-serializable data in errors that cross IPC.

### Avoid widening responsibilities
- Shared domain is not the place for I/O, Electron integration, or UI state.
- Put orchestration in `src/main/application` and side effects in `src/main/infrastructure`.

## Testing notes
- `src/shared/domain/asyncSignal.test.ts` covers `AsyncSignal` behavior (trigger-before-wait, wait-before-trigger, multiple triggers/waiters).
- Domain types (`models.ts`, `results.ts`) are pure declarations and typically do not require tests.
