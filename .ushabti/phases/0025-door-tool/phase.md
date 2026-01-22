# Phase 0025 — Door Tool

## Intent
Add a new **Door tool** to the Map Editor toolbox (left-side tool column) that allows an author to **create a door on a portal** by clicking.

This Phase exists now because:
- Portals are already identifiable in the editor (via the existing “Highlight Portals” overlay), and
- Door properties editing already exists (Phase 0015), but door creation is not yet an ergonomic authoring workflow.

## Scope

### In scope

#### A) Toolbox: new Door tool
- Add a new toolbox button with a **door icon** and tooltip (e.g., “Door”).
- Clicking the button activates the **Door tool** as the current map interaction mode.

#### B) Door placement: click portal to create door
When the Door tool is active:
- The user can click on a **portal wall** to create a door there.
- A **portal** is defined exactly as the editor’s existing portal-highlighting rule:
  - walls whose portal/backing sector reference indicates the boundary is shared between two sectors (renderer doc: `backSector > -1`).
- Creating a door is only allowed when:
  - the cursor is over a portal wall, AND
  - **no door already exists** at that portal (see uniqueness rule below).

Uniqueness rule (authoring invariant):
- At most **one door per portal wall index**.
- A portal is identified by the selected wall’s `wall_index` / wall array index (whichever is the canonical door linkage in the current map schema).

#### C) Cursor feedback (valid vs invalid placement)
When the Door tool is active:
- The cursor must communicate whether a click would place a door:
  - Over a valid, door-less portal: use an affirmative cursor (e.g., `crosshair`).
  - Elsewhere (not a portal or already has a door): use a negative/blocked cursor (e.g., `not-allowed`) or an idiomatic “X” cursor treatment.

#### D) Main-process edit command to create a door
Add a new **typed** map edit command in the main-owned map edit system to create the door.
- The renderer must request the edit via `window.nomos.map.edit(...)` (L03).
- The edit must be atomic, undoable/redoable, and revision-gated like other edits.

New atomic command (proposed):
- `map-edit/create-door`
  - Inputs include the portal wall identity (wall index) and any optional defaults.
  - On success, the command returns a selection effect selecting the newly created door.

Door defaults:
- `id` must be unique (string).
- `wall_index` is set to the clicked portal wall.
- `starts_closed` defaults to `true`.
- No default `tex` is applied.
  - The door is created without a `tex` value; the author must select one in the Inspector.
  - Representation in JSON should follow existing optional-field conventions:
    - prefer **omitting** the `tex` key if the runtime tolerates it, otherwise use a tolerated “unset” sentinel (e.g., empty string) consistent with existing door decoding/validation.

### Out of scope
- Editing door properties beyond what already exists in the Inspector.
- Creating doors on non-portal walls.
- Auto-placing doors at arbitrary points (doors are linked to portal walls, not free-positioned).
- Any runtime/gameplay behavior changes (locking, triggers, animations).
- Adding a View overlay toggle specifically for “valid door portals” (cursor feedback is sufficient for this Phase).

## Constraints
- **L01 (Cross-platform parity):** Cursor and input handling must be platform-agnostic; no OS-specific event handling.
- **L02 (Offline):** No network requirement.
- **L03 (Electron security):** Renderer cannot mutate the map JSON; door creation must flow through typed IPC and main-owned edit services.
- **L04 (Testing):** Any changed/added public methods and new command branching must be covered with unit tests across success/failure paths.
- **L08 (Design for testability):** Add pure helper(s) for “is this click a valid door placement?” so logic is deterministic and testable.
- **L09 (Docs):** Update `docs/` to document the new tool and the new map edit command.

Style guide considerations (from `.ushabti/style.md`):
- Keep policy/validation in main (MapCommandEngine) and keep renderer logic focused on interaction + feedback.
- Prefer discriminated unions/registry-driven tool definitions (avoid scattered `switch` trees).
- Avoid new dependencies.

## Assumptions (explicit)
- Doors are represented in map JSON as an array (commonly `doors`) where each entry links to a wall via `wall_index` and has a stable string `id`.
- The editor already has reliable wall picking (Select tool) and can determine “wall under cursor” in the Map Editor canvas.
- The portal predicate used by rendering/highlighting is the authoritative one; Door tool must reuse the same predicate to avoid divergence.
- A door “already present at a portal” can be detected by scanning existing door entries for `wall_index === clickedWallIndex`.

## Acceptance criteria

### Door tool UX
- A Door tool button exists in the toolbox (left tool column) with a door icon and tooltip.
- Clicking the button activates the Door tool.

### Valid placement rules
- When Door tool is active:
  - Clicking a **portal** that has **no existing door** creates a new door.
  - Clicking:
    - a non-portal wall, or
    - a portal that already has a door
    does **not** create a door and does not crash.

### Cursor feedback
- With Door tool active:
  - Over a door-less portal: cursor indicates “placeable” (e.g., crosshair).
  - Over invalid locations: cursor indicates “blocked” (e.g., not-allowed / X).

### Command behavior, undo/redo, and selection
- Door creation is applied via a single main-process map edit command (`map-edit/create-door` or equivalent).
- On success:
  - map document becomes dirty, revision bumps, and undo/redo works.
  - the new door becomes the current selection.
  - the created door has `starts_closed === true`.
  - the created door has no `tex` set (author must set it after creation).
- On failure (invalid portal / existing door / malformed JSON):
  - the edit is rejected with a typed error; the document is unchanged.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Docs are updated:
  - `docs/map-edit-command-system.md` includes the new atomic command.
  - `docs/renderer-ui-system.md` describes the Door tool behavior and placement constraints.

## Risks / notes
- **No default texture:** If the runtime/validator requires a non-empty `tex`, door creation may need to write a tolerated “unset” representation (e.g., empty string) or the tool may need to prompt immediately after creation; this Phase assumes door entries can exist without a texture assigned.
- **Portal schema naming:** The user referenced `backing_sectors`; the renderer doc references `backSector`. Implementation must follow the canonical decoded predicate (same one used by “Highlight Portals”).
- **Duplicate prevention:** Enforcing “one door per portal wall” in main is mandatory to keep renderer-only checks from becoming a security/integrity footgun.
