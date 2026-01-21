# Nomos Studio docs

This folder documents the major subsystems in Nomos Studio. Each doc is written to be checked against unit tests and source code.

## Systems

- [app-store-system.md](app-store-system.md): Main-process `AppStore`, renderer snapshot store, and state sync.
- [ipc-system.md](ipc-system.md): Typed IPC contract + handler registration.
- [preload-system.md](preload-system.md): `window.nomos` preload bridge (renderer security boundary).
- [windowing-system.md](windowing-system.md): `BrowserWindow` factories + security webPreferences.

- [settings-system.md](settings-system.md): Settings persistence, codec, and renderer UI flow.
- [assets-system.md](assets-system.md): Asset indexing, open-asset, and byte-reading for textures.
- [process-system.md](process-system.md): `ProcessRunner` abstraction used for map validation.

- [maps-system.md](maps-system.md): Open/validate/save flows and map document lifecycle.
- [map-edit-command-system.md](map-edit-command-system.md): Transactional edit commands + undo/redo.

- [menu-system.md](menu-system.md): Cross-platform application menu template.
- [renderer-ui-system.md](renderer-ui-system.md): Renderer UI composition (DockView + canvas editor).
- [shared-domain-system.md](shared-domain-system.md): Shared types and error/result model.
