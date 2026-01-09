# Nomos Studio — Map Editor

Cross-platform (macOS/Windows/Linux) Electron map editor for a 2.5D old-school raycasting FPS engine.

## Phase 0001 (Bootstrap)
This repository is currently in the bootstrap phase. The goal is tooling + skeleton only: install, typecheck, test, build, run, and show a window with a minimal UI shell.

### Toolchain (chosen for maturity and broad adoption)
- Electron Forge (Webpack + TypeScript templates)
- React (renderer UI)
- TypeScript (strict)
- Zustand (state management)
- Blueprint.js (UI toolkit)
- DockView (panel/layout)
- react-konva (+ konva) (shape drawing)

### Repository layout
- `src/main/` — Electron main process (window creation, lifecycle)
- `src/preload/` — Preload bridge (minimal, explicit API surface)
- `src/renderer/` — React renderer UI
- `src/shared/` — Shared types/utilities (kept free of Electron/React imports)

## Development (once dependencies are installed)
- `npm ci`
- `npm run dev` (launches Electron)
- `npm run typecheck`
- `npm test`
- `npm run build`

## Laws and Style
- Project invariants: `.ushabti/laws.md`
- Project style guide: `.ushabti/style.md`
