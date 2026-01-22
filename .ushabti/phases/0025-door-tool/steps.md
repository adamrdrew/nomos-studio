# Phase 0025 Steps — Door Tool

## S001 — Inspect current toolbox/tool registry + wall picking + portal predicate
- **Intent:** Reuse existing tool architecture and avoid duplicating portal logic.
- **Work:**
  - Locate the toolbox tool registry and how tools are represented (tool IDs, icons, tooltips).
  - Locate wall hit-testing / “wall under cursor” logic in `MapEditorCanvas`.
  - Identify the single canonical portal predicate used by “Highlight Portals” (renderer doc: `backSector > -1`) and capture where it lives (decode vs render).
- **Done when:** Notes record the exact modules/symbols to extend and the portal predicate implementation location.

## S002 — Confirm door JSON schema + decide defaults + uniqueness rule
- **Intent:** Prevent writing invalid doors and clarify the invariants.
- **Work:**
  - Inspect existing authored maps / fixtures (if any) to confirm door entry shape:
    - required keys (`id`, `wall_index`, `tex`, `starts_closed`, optional lock fields)
  - Decide default values for newly created doors:
    - `starts_closed` default (Phase decision: `true`)
    - representation for “no texture selected yet” (Phase decision: no default `tex`)
  - Confirm the “one door per portal” uniqueness key:
    - enforce `doors[].wall_index` uniqueness
- **Done when:** Decisions are recorded and reflected back into Phase assumptions if they differ.

## S002a — Allow doors to exist without a texture (renderer decode + UI)
- **Intent:** Support “no default tex” door creation without making the map undecodable in the editor.
- **Work:**
  - Update renderer map view model so door `tex` can be missing/unset (e.g., `string | null`).
  - Update door decoding so `doors[].tex` is optional:
    - missing or empty string decodes as `null`.
    - existing non-empty `tex` continues to decode unchanged.
  - Update the Door Properties editor so that:
    - a door with `tex === null` renders a clear “(select texture)” placeholder state.
    - selecting a texture commits `tex: '<file>'` via `map-edit/update-fields`.
- **Done when:** After creating a door without `tex`, the map still decodes and renders, and the Inspector can set `tex`.

## S003 — Extend shared IPC types with a create-door atomic command
- **Intent:** Make door creation an official typed operation in the map edit command system.
- **Work:**
  - Extend `MapEditAtomicCommand` with a new variant (proposed):
    - `kind: 'map-edit/create-door'`
    - `atWallIndex: number` (or `target: { kind: 'wall', index }`), plus any required defaults.
  - Extend `MapEditError` typing with any new error codes needed (e.g., not-a-portal, door-already-exists, invalid-walls-shape).
  - Ensure exhaustiveness checks are updated.
- **Done when:** TypeScript compiles and the new union member is wired through all shared IPC shapes.

## S004 — Implement create-door in main MapCommandEngine
- **Intent:** Enforce validity centrally and keep edits deterministic/atomic.
- **Work:**
  - Implement `map-edit/create-door` in `MapCommandEngine.applyAtomic`.
  - Validate (at minimum):
    - map root is a record
    - `walls` exists and is an array
    - target wall index is in-range
    - target wall is a portal (same predicate the editor uses conceptually: backing sector present)
    - `doors` is absent or an array
    - no existing door has `wall_index === targetWallIndex`
  - Create a new door record with:
    - unique `id` generation (collision-safe, deterministic within a single apply)
    - `wall_index` set to target
    - `starts_closed: true`
    - `tex` omitted / unset (per S002 decision)
  - Return selection effect selecting the new door (`{ kind: 'door', id }`).
- **Done when:** Engine returns `nextJson` with the new door appended and emits the correct selection effect; failures return typed errors without mutation.

## S005 — Unit tests: MapCommandEngine create-door
- **Intent:** Satisfy L04 by covering conditional paths and preventing regressions.
- **Work:** Add tests covering at least:
  - Success: creates a door on a portal wall, appends to `doors`, selection set to new door.
  - Failure: wall index out of bounds.
  - Failure: wall is not a portal.
  - Failure: door already exists for wall_index.
  - Failure: `doors` present but not an array.
  - Failure: malformed wall/door entries (non-object) handled safely.
- **Done when:** Tests pass and assert typed error codes for each failure.

## S006 — Unit tests: MapEditService integration for create-door
- **Intent:** Ensure history/dirty/revision behavior matches other edits.
- **Work:**
  - Add/extend `MapEditService` tests verifying:
    - successful create-door bumps revision, sets dirty, clears lastValidation
    - undo removes the created door; redo re-adds it
    - stale baseRevision rejects without store/history mutation
- **Done when:** Tests cover success + stale failure and pass.

## S007 — Add Door tool to renderer tool registry + toolbox button
- **Intent:** Expose the tool in the left toolbox with consistent UX.
- **Work:**
  - Add a new tool id (e.g., `door`) to the tool registry.
  - Add a toolbox button using an existing icon system (or a small inline SVG) and tooltip.
  - Ensure selecting Door tool updates the interaction mode used by `MapEditorCanvas`.
- **Done when:** Door tool is selectable in-app and becomes the active tool.

## S008 — Implement Door tool interaction in MapEditorCanvas (hover + click)
- **Intent:** Enable click-to-create with strict validity + clear feedback.
- **Work:**
  - Determine hovered wall under cursor using existing picking logic.
  - Compute `canPlaceDoorHere` based on:
    - hovered wall exists
    - wall is a portal
    - no existing door at that wall
  - Set cursor based on `canPlaceDoorHere` (crosshair vs not-allowed / X).
  - On click:
    - if `canPlaceDoorHere` is false, no-op (no crash)
    - if true, call `window.nomos.map.edit({ baseRevision, command: create-door(...) })`
  - Handle stale revision errors by refreshing snapshot (per existing stale-edit policy) and keeping UI consistent.
- **Done when:** In-app manual check shows cursor feedback and only valid clicks create doors.

## S009 — Docs update (L09)
- **Intent:** Keep subsystem docs accurate.
- **Work:**
  - Update `docs/map-edit-command-system.md` with the new atomic command shape and semantics.
  - Update `docs/renderer-ui-system.md` to describe:
    - Door tool
    - portal-only placement
    - one-door-per-portal constraint
    - cursor feedback
  - Update `docs/maps-system.md` only if it enumerates supported edit commands in a way that must include create-door.
- **Done when:** Docs match implemented behavior and public contract.

## S010 — Quality gates + manual verification record
- **Intent:** Finish the Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual verify:
    - Door tool button appears and toggles active state
    - cursor feedback changes correctly
    - click portal without door creates door
    - click portal with existing door does nothing
    - click non-portal does nothing
    - undo/redo works for door creation
- **Done when:** All commands pass and verification notes are recorded in `review.md`.
