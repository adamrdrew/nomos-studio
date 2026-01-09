# Phase 0001 Manual Verification Checklist

This checklist verifies the Phase 0001 acceptance criteria (bootstrap only).

## Preconditions
- Node.js 20+ installed
- A local clone of the repo
- Network access is only needed to install npm dependencies; the app itself must run offline.

## Install
- `npm install`

## Typecheck
- `npm run typecheck`
- Expected: exits successfully.

## Unit tests
- `npm test`
- Expected: exits successfully and produces coverage output.

## Build
- `npm run build`
- Expected: packaging step completes on your OS.

## Dev run (online)
- `npm run dev`
- Expected:
  - An Electron window opens.
  - Renderer shows the bootstrap UI:
    - A Blueprint button that increments a click count
    - A DockView panel titled “Bootstrap Panel”
    - A Konva shape in the panel

## Dev run (offline)
- Disable network connectivity (e.g., turn off Wi‑Fi and disconnect ethernet).
- Run: `npm run dev`
- Expected:
  - The app still launches and renders the same UI.

## Security spot-check (code inspection)
- Confirm in code that:
  - `nodeIntegration` is false
  - `contextIsolation` is true
  - preload uses an explicit bridge
- Files to inspect:
  - `src/main/windows/createMainWindowWebPreferences.ts`
  - `src/preload/preload.ts`
