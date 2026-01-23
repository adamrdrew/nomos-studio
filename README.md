# Nomos Studio

Cross-platform (macOS/Windows/Linux) Electron map editor for a 2.5D old-school raycasting FPS engine.

Nomos Studio is designed to run **fully offline** and keep Electron security boundaries tight (renderer UI has no Node access; privileged operations go through a narrow preload API).

## What you can do

Core workflows:
- Open, edit, and save JSON map files.
- Validate maps by invoking your configured game executable.
- Fast iteration loop: **Run → Save & Run (F5)** (save → validate → run).

Editor UI:
- Dockable editor layout (Map Editor + Inspector + Entities).
- Wireframe or textured rendering.
- Floor/ceiling surface selection in textured mode.
- Grid toggle + opacity controls.
- View overlays: portal highlighting, toggle-wall highlighting, door visibility.
- Tools: select, move (drag entities/lights), door placement, room creation (rectangle/square/triangle).
- Asset Browser with double-click routing:
	- `Levels/*.json` opens in the editor.
	- everything else opens via the OS default handler.

Inspector editing:
- Object Properties for common map objects (walls/sectors/doors/entities/lights/particles).
- Map Properties (name, sky, music/soundfont, player start with “pick” mode).
- SKY ceilings supported: setting a sector ceiling texture to `SKY` renders using the map-level `sky` texture.

Undo/redo:
- Main-process-owned, bounded undo/redo with transactional edits.

## Quick start (developers)

### Prerequisites
- Node.js (recommend Node 20+)
- npm

### Install
```sh
npm ci
```

### Run the app
```sh
npm run dev
```

### Run quality gates
```sh
npm run typecheck
npm run lint
npm test
```

Notes:
- Jest is configured to run with coverage by default.
- If you prefer serial tests: `npm test -- --runInBand`.

## Quick start (users / first run)

Nomos Studio needs two settings before map open/validation works:
- **Assets directory** (a folder containing your game/editor assets)
- **Game executable** (used for validation and “Save & Run”)

Open Settings via:
- macOS: **Nomos Studio → Preferences…** (`CommandOrControl+,`)
- Windows/Linux: **Settings → Settings…** (`CommandOrControl+,`)

Once configured:
- Use **Open Existing** to open a map file.
- Use **File → Open Map…** from the menu.
- Use **Run → Save & Run (F5)** to validate + launch quickly.

## How validation and “Save & Run” work

Nomos Studio delegates map validation to your configured game executable.

Validation contract:
- Command: `<gameExecutablePath> --validate-map <absoluteMapPath>`
- Exit code `0` = valid
- Any other exit code = invalid (the validator report is shown)

Save & Run contract:
- Save current map → validate → run
- Run command args are the map **filename only** (not full path): `<gameExecutablePath> <mapFileName.json>`

## Assets directory expectations

Nomos Studio indexes files under your configured assets directory and uses **POSIX-style** relative paths (with `/`) in the asset index regardless of OS.

Commonly used paths:
- Maps: `Levels/*.json`
- Textures: `Images/Textures/*` (some UI surfaces also tolerate `Assets/Images/Textures/*`)
- Sky textures: `Images/Sky/*`
- Entities:
	- Manifest at `Entities/entities_manifest.json` (or `Assets/Entities/entities_manifest.json`)
	- Entity def entries referenced by the manifest are resolved under `Entities/` (or `Assets/Entities/`)

Example minimal layout:
```text
<YourAssetsDir>/
	Levels/
		demo.json
	Images/
		Textures/
			WALL_1.png
			FLOOR_1.png
			CEIL_1.png
		Sky/
			red.png
	Entities/
		entities_manifest.json
		imp.json
		imp.png
```

Texture naming note:
- Map fields like `wall.tex`, `sector.floor_tex`, and `sector.ceil_tex` are treated as **texture filenames** (e.g. `WALL_1.png`), not full paths.

## Build and packaging

This repo uses Electron Forge.

- Package (local packaged app):
	```sh
	npm run build
	```
- Make distributables (platform-specific installers/zips):
	```sh
	npm run make
	```

Forge output is written under `out/`.

## Repository structure (architecture at a glance)

Nomos Studio uses explicit boundaries:
- `src/main/` — Electron main process (services, store, window creation, menus)
- `src/preload/` — preload bridge (typed `window.nomos` API)
- `src/renderer/` — React renderer UI (DockView shell + editor UI)
- `src/shared/` — shared domain + IPC contract (no Electron/React imports)

State model:
- Main process owns the authoritative `AppStore`.
- Renderer keeps a small Zustand snapshot store and refreshes when main signals `nomos:state:changed`.

Security model:
- Renderer runs with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- Privileged operations (filesystem, dialogs, process execution) are only reachable via the preload/IPC surface.

## Subsystem documentation

The authoritative subsystem docs live under `docs/`. Start here:
- `docs/README.md`

Notable docs:
- Maps: `docs/maps-system.md`
- Transactional edits/undo/redo: `docs/map-edit-command-system.md`
- Assets: `docs/assets-system.md`
- Settings: `docs/settings-system.md`
- IPC and preload boundary: `docs/ipc-system.md`, `docs/preload-system.md`
- Renderer UI: `docs/renderer-ui-system.md`

## Project laws and style

- Non-negotiable invariants: `.ushabti/laws.md`
- Style guide: `.ushabti/style.md`

If you change a subsystem’s behavior or public API, update its doc under `docs/` in the same change.

## Troubleshooting

### “No assets directory configured”
Open Settings (`CommandOrControl+,`) and set **Assets directory**.

### Maps won’t open / “Map validation failed”
- Ensure **Game executable** is configured.
- The validator must support: `--validate-map <absoluteMapPath>`.
- Read the validator report shown by the editor (stdout preferred, otherwise stderr).

### Textures don’t render
- Ensure the assets directory contains `Images/Textures/`.
- Ensure map texture fields are filenames that exist in that folder.
- Textured rendering loads images via `blob:` URLs; the app CSP is configured to allow `img-src ... blob:`.

### SKY ceilings don’t render
- Set the sector ceiling texture to `SKY` (case-insensitive).
- Set map-level `sky` to a filename present under `Images/Sky/`.
- If `sky` is missing or unloadable, Nomos Studio skips the fill (no crash).

### Entities panel is empty
- Ensure `Entities/entities_manifest.json` (or `Assets/Entities/entities_manifest.json`) exists.
- Ensure the manifest entries point to valid entity def JSON files under the same prefix.

