# Phase 0035 — Room Clone

## Intent
Enable **copy/paste-style room duplication** by letting the user **clone the geometry of a selected room** (sector + boundary walls) into a renderer-local “paste buffer”, then **place** that cloned room using the existing **Room (geometry draw) tool** behaviors.

This Phase exists now because:
- Room selection already works (Select tool can select a room/sector + walls).
- Room placement rules (preview validity, snapping, portals, intersection rejection) already exist and must be reused verbatim.
- Users need a fast way to replicate authored room shapes without re-drawing.

## Scope

### In scope

#### A) Clone-to-buffer UX (Select tool → Room tool)
- When a **sector/room is selected** and the user presses the **Clone** button in the command bar:
  - Capture the selected room’s **boundary geometry** into a **clone/paste buffer**.
  - Switch active tool to the **Room tool** (the existing geometry draw tool).
  - The Room tool shows a **preview polygon** matching the buffered room shape.

#### B) Placement uses existing Room tool invariants
Placement must behave the same as current room placement:
- Live validity preview (green valid / red invalid).
- Magnetic snapping to eligible walls for adjacent placement.
- Portal creation when placed adjacent (wall cutting / portal wiring).
- Allow placement nested inside sectors and adjacent outside sectors.
- Disallow intersecting walls (same definition as existing placement).

#### C) Clone copies properties but not identity
When the cloned room is placed, it transfers:
- **Sector properties** from the source sector (e.g., floor/ceiling z, textures, light, toggled-floor settings).
- **Wall properties** from the source boundary walls (e.g., texture, end-level, toggle wall fields).

It must **not** transfer identity or topology references:
- New sector id must be unique.
- New vertices/walls must be newly allocated indices.
- `front_sector` / `back_sector` assignments must follow the placement rules (nested/adjacent/seed), not be copied.

#### D) Main-owned atomic edit
- Placement must be committed via a **typed main-process map edit command** (L03), keeping determinism/undo/redo consistent with existing edits.

#### E) Docs and tests
- Update subsystem docs (L09) describing the new cloning/placement workflow.
- Add unit tests for any new/changed public methods (L04), covering meaningful conditional paths.

### Out of scope
- Cloning entities, lights, particles, doors, or any non-geometry content “inside” the room.
- System clipboard integration (Cmd+C/Cmd+V) and multi-item clipboard history.
- Editing the clone buffer (advanced transforms beyond the existing rotate/scale behaviors).
- Cloning multi-loop sectors (holes) or malformed sector boundaries beyond an explicit “clone disabled” state.

## Constraints
Must comply with `.ushabti/laws.md`, especially:
- **L01 (Cross-platform parity):** behavior and input handling equivalent across macOS/Windows/Linux.
- **L03 (Electron security):** renderer must not mutate map JSON; placement must go through `window.nomos.map.edit(...)`.
- **L04 (Testing):** new/changed public methods must have unit tests covering conditional paths.
- **L08 (Testability):** geometry extraction/transforms/validity must be pure helpers (deterministic; no Konva/Electron).
- **L09 (Docs current):** update relevant docs under `docs/`.

Must follow `.ushabti/style.md`:
- Keep domain/geometry correctness logic out of UI components.
- Prefer small, typed helpers and narrow public APIs.
- Avoid adding dependencies.

## Phase decisions (recorded assumptions)
- **Trigger surface:** The existing **Clone** command bar action is reused.
  - If the current selection is a **sector**, Clone enters “room clone placement” (buffer + switch to Room tool).
  - For other selection kinds, existing clone behavior remains unchanged.
- **Source geometry definition:** the cloned shape is the selected sector’s **single boundary loop polygon**.
  - If a sector boundary loop cannot be constructed deterministically, cloning is disabled for that selection (no crash; user-visible feedback).
- **Property copy set:** copy all sector + wall authoring properties represented in the renderer map view model, excluding topology/identity fields.
- **Placement parity:** clone placement uses the **same validity + snapping + portal creation** logic path as template-based room placement.

## Acceptance criteria

### User workflow (DoD)
- A user can select a room with the Select tool.
- With a room selected, clicking **Clone** in the command bar:
  - stores that room’s geometry in a clone/paste buffer
  - switches to the Room tool
  - shows a preview shape matching the buffered room geometry
- The user can place the cloned room into the map.

### Placement parity
- The Room tool behaves exactly as it does today:
  - green/red validity preview
  - magnetic snapping behavior
  - portal creation via wall cutting when placed adjacent
  - nested placement supported
  - intersecting-wall placements rejected

### Property carry-over
- The newly placed room:
  - has a new unique sector id
  - preserves the source sector’s floor/ceiling/light properties
  - preserves the source walls’ authoring properties (texture/toggles/end-level)

### Correctness / invariants
- Adjacent placement preserves wall index stability (existing `walls[]` entries are not reordered) and reuses portal endpoint vertices on both sides, matching the existing create-room guarantees.
- Undo/redo works for cloned-room placement exactly like other map edits.

### Quality gates
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- Docs updated:
  - `docs/map-edit-command-system.md`
  - `docs/renderer-ui-system.md`

## Risks / notes
- **Sector boundary reconstruction:** sectors may be malformed or have ambiguous edge ordering; this Phase explicitly allows disabling clone for those cases rather than guessing.
- **Portals in source room:** source portal walls must be treated as ordinary boundary walls for property copying; connectivity is determined by the new placement.
- **Concave geometry:** must be supported if the existing placement validity supports arbitrary polygons; ensure tests cover concave cases.
