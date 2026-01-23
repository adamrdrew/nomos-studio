# Process System

## Overview
Nomos Studio invokes an external “game executable” to validate maps. To keep this testable and to isolate OS/process side effects, process execution is wrapped behind a small `ProcessRunner` interface.

This subsystem lives entirely in the main process (privileged). The renderer never spawns processes directly (L03).

## Architecture

### Abstraction
- `src/main/infrastructure/process/ProcessRunner.ts`
	- Defines a minimal `ProcessRunner` interface with a single `run()` method.
	- Defines request/response shapes (`ProcessRunRequest`, `ProcessRunResult`).

### Node implementation
- `src/main/infrastructure/process/NodeProcessRunner.ts`
	- Production `ProcessRunner` using Node’s `child_process.spawn`.
	- Aggregates stdout/stderr into strings and resolves with exit code.
	- Sets `windowsHide: true` to avoid flashing consoles on Windows.

### Consumer (current)
- `src/main/application/maps/MapValidationService.ts`
	- Uses `ProcessRunner.run({ command, args })` to call the configured game executable:
		- `command = settings.gameExecutablePath`
		- `args = ['--validate-map', absoluteMapPath]`

### Consumer (added)
- `src/main/application/maps/SaveAndRunMapService.ts`
	- Orchestrates save → validate → run.
	- Uses `ProcessRunner.run({ command, args })` to run the configured executable:
		- `command = settings.gameExecutablePath`
		- `args = [mapFileName]` (filename only)

## Public API / entrypoints

### Infrastructure API
- `ProcessRunner`
	- `run(request: ProcessRunRequest): Promise<ProcessRunResult>`

### Current main-process usage
- `MapValidationService.validateMap(mapPath)` runs the validator process.

## Data shapes

Defined in `src/main/infrastructure/process/ProcessRunner.ts`:
```ts
type ProcessRunRequest = Readonly<{
	command: string;
	args: readonly string[];
}>;

type ProcessRunResult = Readonly<{
	exitCode: number | null;
	stdout: string;
	stderr: string;
}>;
```

## Boundaries & invariants

### Main-process-only (L03)
- Process spawning must remain in main process.
- Renderer requests that *result in* process execution must go through typed IPC commands.

### System safety (L06)
- The only process currently executed is the user-configured `gameExecutablePath`.
- Avoid adding any IPC that would allow arbitrary command execution.

### Cross-platform behavior (L01)
- `nodeProcessRunner` uses Node’s `spawn` and returns `exitCode/stdout/stderr`, which is portable across macOS/Windows/Linux.
- Consumers should treat `exitCode: null` as a failure state (process terminated by signal or could not provide an exit code).

### Output handling
- `nodeProcessRunner` aggregates stdout/stderr in-memory.
- Consumers decide how to interpret the output (e.g., `MapValidationService` prefers stdout when present, otherwise stderr).

## How to extend safely

### Adding new process-backed features
- Add new application-layer services that depend on `ProcessRunner` via injection.
- Keep commands narrow and explicit; avoid “shell” execution.
- Prefer returning typed `Result<...>` errors from application services rather than letting spawn exceptions escape.

### Avoid shell parsing pitfalls
- Continue using `spawn(command, args)` rather than shell strings.
- Treat all args as explicit list items (no string concatenation that could create injection risks).

### If output can be large
- Consider streaming or size-bounding if a future integration might produce very large outputs.

## Testing notes
- `src/main/infrastructure/process/NodeProcessRunner.test.ts` mocks `child_process.spawn` and asserts:
	- stdout/stderr aggregation behavior
	- exit code propagation
	- error event rejection

- Consumers (e.g., `MapValidationService.test.ts`) stub `ProcessRunner` to cover conditional paths without spawning real processes.
