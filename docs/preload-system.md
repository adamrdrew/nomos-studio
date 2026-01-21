# Preload System

## Overview
Nomos Studio uses an Electron preload script as the **only** renderer entrypoint to privileged operations.

- The preload runs with access to Electron APIs (`ipcRenderer`, etc.).
- The renderer runs with **no Node integration** and uses `window.nomos` for all privileged actions.
- All request/response IPC types and channel names are centralized in `src/shared/ipc/nomosIpc.ts`.

This subsystem exists to keep a clean security boundary (L03): renderer code is UI-only, and the main process owns filesystem/process/dialog operations.

## Where it lives

- Preload implementation: `src/preload/preload.ts`
- Renderer-facing type surface: `src/preload/nomos.d.ts`
- IPC contract (channels + payload types): `src/shared/ipc/nomosIpc.ts`

Window security posture is configured in:
- `src/main/windows/createMainWindowWebPreferences.ts`

## Architecture

### `window.nomos` API
The preload exposes a minimal, namespaced API:

- `window.nomos.settings.*`
- `window.nomos.dialogs.*`
- `window.nomos.assets.*`
- `window.nomos.map.*`
- `window.nomos.state.*`

Implementation pattern:
- invoke-style calls: `ipcRenderer.invoke(channel, payload)`
- one narrow event stream: `ipcRenderer.on(NOMOS_IPC_CHANNELS.stateChanged, ...)`

### Typed contract
- Channel constants: `NOMOS_IPC_CHANNELS` in `src/shared/ipc/nomosIpc.ts`
- Request/response types are imported by both preload and main.
- The renderer types `window.nomos` using `src/preload/nomos.d.ts`.

### State change event
`window.nomos.state.onChanged(listener)` subscribes to main→renderer events.

- The payload is optional.
- Today the only defined payload field is `selectionEffect?: MapEditSelectionEffect`, which is used to reconcile renderer selection for main-triggered operations (e.g., menu Undo/Redo).

## Boundaries & invariants

### Security boundary (L03)
- Do not import Electron or Node APIs in renderer code.
- Do not expose raw Electron primitives (e.g., `ipcRenderer`) to the renderer.
- Prefer narrow, specific operations over generic capabilities.

### Runtime validation
Electron delivers IPC args as `unknown` at runtime.

- `src/main/ipc/registerNomosIpcHandlers.ts` performs minimal validation for some safety-sensitive operations (edit/undo/redo request shape).
- For new operations with meaningful risk, validate inputs in the handler layer before delegating to application services.

## How to extend safely

### Adding a new preload method
1. Add a channel + request/response types to `src/shared/ipc/nomosIpc.ts`.
2. Register a handler in `src/main/ipc/registerNomosIpcHandlers.ts` and wire it in `src/main/main.ts`.
3. Add a wrapper method in `src/preload/preload.ts` that calls `ipcRenderer.invoke(...)`.
4. Update `src/preload/nomos.d.ts` so renderer code is fully typed.
5. Use it in the renderer via `window.nomos.<area>.<method>()`.

### Keep the API minimal
- Prefer strongly-typed “verbs” (`saveMap`, `refreshIndex`) over passing paths/commands around.
- Avoid any IPC that could enable arbitrary command execution or arbitrary filesystem access.

## Testing notes
- Preload logic is intentionally thin; most behavior is tested in the main handler and application service layers.
- IPC wiring tests: `src/main/ipc/registerNomosIpcHandlers.test.ts`
