# Phase 0036 Review — Light Creation Tool

## Summary

Phase intent is implemented end-to-end (tool + cursor affordance + typed IPC create command + inspector flicker control + docs). Follow-up tests were added to satisfy L04 branch coverage, and all quality gates pass.

## Verified

- **L01 (cross-platform parity):** Cursor behavior is platform-aware and provides an equivalent valid/invalid signal (mac: custom SVG cursors; win/linux: `copy` vs `not-allowed`).
- **L02 (offline):** No network-dependent behavior introduced.
- **L03 (Electron security):** Light creation is routed through `window.nomos.map.edit(...)` and a typed main-process command (`map-edit/create-light`). Renderer does not directly mutate map JSON.
- **L09 (docs):** Updated renderer UI and map-edit command docs to include the Light tool and `map-edit/create-light`.

Acceptance criteria (implementation evidence):
- **Toolbox + hotkeys:** Light tool is added to `MAP_EDITOR_TOOLS` (registry-driven), so it participates in the existing hotkey system by construction.
- **Cursor feedback:** Cursor is derived from `pickSectorIdAtWorldPoint(...)` and switches between valid/invalid forms.
- **Create behavior:** Clicking in Light mode issues `map-edit/create-light`, which appends a new light with defaults and returns a selection-set effect.
- **Flicker editor:** Inspector exposes a dropdown constrained to `none|flame|malfunction`, and uses `MAP_EDIT_UNSET` to represent “none” by omitting the JSON key.

## Issues

None.

## Required follow-ups

None.

## Decision

Phase is **green** and ready to be marked complete.

Validated:
- Acceptance criteria: toolbox + hotkeys participation; cursor valid/invalid feedback; click-to-create via typed IPC (`map-edit/create-light`); light `flicker` editor constrained to valid options with “none” represented by unsetting.
- Laws: L01/L02/L03/L04/L08/L09.
- Quality gates: Jest passes (full suite), TypeScript typecheck passes, ESLint passes.

The work has been weighed and found complete.

