# Phase 0036 Steps — Light Creation Tool

## S001 — Confirm UX decisions and schema conventions
- **Intent:** Remove ambiguity before adding new tool + command surface.
- **Work:**
  - Confirm Light tool placement in `MAP_EDITOR_TOOLS` order (determines its hotkey): **end of toolbox**.
  - Confirm cursor mapping:
    - macOS: X when invalid, green plus when valid
    - Windows/Linux: any idiomatic equivalents that clearly signal valid vs invalid placement
  - Confirm defaults for newly created lights (`radius`, `intensity`, `color`, `flicker`).
  - Confirm flicker value set and “none” representation **per map spec** (prefer omitting key via `MAP_EDIT_UNSET`).
- **Done when:** `phase.md` decisions and acceptance criteria are unambiguous.

## S002 — Add Light tool to the toolbox registry
- **Intent:** Make the tool appear in the left toolbar and automatically participate in hotkeys.
- **Work:**
  - Extend the tool id union and `MAP_EDITOR_TOOLS` registry with a new Light tool.
  - Use a light-bulb icon and appropriate tooltip.
  - Add a new `MapEditorInteractionMode` variant for Create Light Mode.
- **Done when:** The toolbox renders the Light button and hotkey badges include it.

## S003 — Implement Create Light Mode cursor feedback
- **Intent:** Provide clear “can create / cannot create” affordance.
- **Work:**
  - In the Map Editor canvas, when Create Light Mode is active:
    - compute `sectorId = pickSectorIdAtWorldPoint(authoredWorldPoint, decodedMap)`
    - set cursor to “valid” (plus/copy) if `sectorId !== null`, else “invalid” (X/blocked)
  - Keep platform-specific cursor selection in a small helper (L01/L08).
- **Done when:** Cursor changes live while moving the mouse and matches the acceptance criteria.

## S004 — Add a typed main-process command: `map-edit/create-light`
- **Intent:** Create lights through the existing secure edit pipeline (L03) with explicit typing.
- **Work:**
  - Extend `MapEditAtomicCommand` in shared IPC types with:
    - `kind: 'map-edit/create-light'`
    - `at: { x: number; y: number }`
    - optional overrides if needed (keep minimal)
  - Extend `MapEditService` command whitelist/exhaustiveness to accept the new command.
- **Done when:** TypeScript compiles and the new command is callable end-to-end.

## S005 — Implement `map-edit/create-light` in `MapCommandEngine`
- **Intent:** Define the authoritative mutation semantics and selection effect.
- **Work:**
  - Validate `at.x/at.y` are finite numbers.
  - Ensure `lights` exists and is an array (create empty array if missing).
  - Append a new light object with the agreed defaults.
  - Return selection set to `{ kind: 'light', index: <newIndex> }`.
- **Done when:** Engine creates the new light deterministically and returns a selection-set effect.

## S006 — Wire canvas click to create lights
- **Intent:** Deliver the user-facing “click to create” workflow.
- **Work:**
  - In Create Light Mode `onMouseDown`:
    - compute authored world point
    - guard: decoded map ok, map document exists
    - guard: point must be inside a sector (`pickSectorIdAtWorldPoint !== null`)
    - issue `window.nomos.map.edit({ baseRevision, command: { kind: 'map-edit/create-light', at } })`
    - handle stale revision by refreshing from main
    - apply returned selection effect
- **Done when:** Clicking inside a sector creates a light; clicking outside does nothing.

## S007 — Extend renderer map decoding + view model to include light flicker
- **Intent:** Surface `flicker` to the Inspector and keep decoding strict/typed.
- **Work:**
  - Extend `MapLight` in the renderer view model with `flicker`.
  - Extend `decodeLight` in the map decoder to parse an optional `flicker` string and map it to a typed union:
    - `none | flame | malfunction`
  - Decide and implement default when missing (typically `none`).
- **Done when:** A map containing valid `lights[].flicker` decodes and is visible in the selection model.

## S008 — Add flicker control to the Light Properties editor
- **Intent:** Allow authors to set flicker only to valid options.
- **Work:**
  - Add a `flicker` dropdown/select in the light editor UI with options:
    - (none), flame, malfunction
  - Commit via `map-edit/update-fields`:
    - selecting (none) should unset or set `"none"` per decision
    - selecting other options writes the corresponding string
- **Done when:** Flicker edits persist (save + reopen) and do not allow invalid values.

## S009 — Unit tests for new command + decoding behavior (L04)
- **Intent:** Lock down public behavior and cover conditional paths.
- **Work:**
  - Add `MapCommandEngine` tests for `map-edit/create-light`:
    - creates light when `lights` missing (treat as empty)
    - creates light when `lights` exists
    - rejects invalid `at` (non-finite)
  - Update `MapEditService` tests to include the new command kind.
  - Update `mapDecoder` tests for flicker parsing (missing/default + valid values).
- **Done when:** Jest suite passes and tests cover success/failure branches.

## S010 — Update docs (L09) + run quality gates
- **Intent:** Keep subsystem docs current and ensure repo stays green.
- **Work:**
  - Update `docs/renderer-ui-system.md` to document the Light tool, cursor feedback, and hotkey participation.
  - Update `docs/map-edit-command-system.md` to document `map-edit/create-light`.
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** Docs match behavior and all gates pass.

## S011 — Add missing MapCommandEngine branch coverage for create-light (L04)
- **Intent:** Satisfy L04 by covering all conditional paths in the public `MapCommandEngine.apply(...)` behavior for `map-edit/create-light`.
- **Work:**
  - Add a unit test that calls `MapCommandEngine.apply(...)` with `kind: 'map-edit/create-light'` when `json.lights` is present but not an array (e.g., `lights: {}` or `lights: 123`).
  - Assert the result is a failure with `error.code === 'map-edit/invalid-json'`.
- **Done when:** The new test passes and the `lights`-present-but-invalid branch is exercised via the public `apply(...)` API.

## S012 — Add missing mapDecoder branch coverage for invalid light flicker (L04)
- **Intent:** Satisfy L04 by covering the new conditional paths in the public `decodeMapViewModel(...)` behavior for `lights[].flicker`.
- **Work:**
  - Add a unit test where `lights[].flicker` is present but not a string (e.g., `flicker: 123`) and assert decode fails.
  - Add a unit test where `lights[].flicker` is a string but not one of the allowed values (e.g., `flicker: 'strobe'`) and assert decode fails.
- **Done when:** Both tests pass and exercise the non-string and invalid-string branches via `decodeMapViewModel(...)`.
