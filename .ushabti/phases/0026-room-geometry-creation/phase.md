# Phase 0026 — Room Geometry Creation

## Intent
Add **room-based geometry creation** to the Map Editor so authors can extend maps without directly managing low-level `vertices` / `walls` / `sectors`.

This Phase introduces a new **Room tool** (pencil) that:
- previews a template room (rectangle/square/triangle) under the cursor,
- indicates validity (green) vs invalid placement (red),
- and on click performs a **single, main-owned, atomic** edit that adds the required low-level objects while preserving map correctness.

This Phase exists now because geometry creation is the critical missing authoring capability; the editor must **aggressively enforce correctness** and prevent authors from creating invalid topology.

## Scope

### In scope

#### A) New Room tool (toolbox) + room-shape commands (tool bar)
- Add a new toolbox button with a **pencil icon** and tooltip “Room”.
- When active, the tool bar exposes three commands:
  - **Rectangle**
  - **Square**
  - **Triangle**
- Selecting a command sets the active room template used for preview + placement.

#### B) Live placement preview with strict validity
When the Room tool is active and a template is selected:
- Moving the mouse over the map shows an outline of the candidate room.
- Outline color indicates validity:
  - **Green**: click would create a room
  - **Red**: click does nothing

Validity rules (must be enforced, not advisory):
- The candidate room polygon must not **intersect** or **overlap** any existing wall segments, except where an intentional portal join will be created (see D).
- The candidate room must be either:
  - **Nested**: fully inside an existing sector, OR
  - **Adjacent**: outside all sectors but **snappable** to an existing wall (see C).
- Room placement is rejected if it would create an “island” disconnected from the existing map (see C).

#### C) Connectivity rule (“no empty space rooms”)
- Rooms may not be created in empty space.
- If a room is not nested inside an existing sector, it is only valid if it is **close to an existing wall** (within a fixed snap threshold in screen pixels) and can be created as an **adjacent join**.

#### D) Auto-wiring adjacent rooms via portals (wall cutting)
When an adjacent room is created near an existing wall:
- The editor **snaps** the new room to the existing room boundary.
- The editor then “wires” the rooms together by creating a **portal connection**.
- Implementation requirement: create the portal by **cutting** the longer boundary edge(s) such that:
  - a shared portal segment exists,
  - both sectors contain a matching wall segment for the portal,
  - and the portal is represented by setting each wall’s `back_sector` to the other sector id.

Critical safety requirements for wiring:
- Do not reorder existing wall array entries (to avoid destabilizing door `wall_index` references).
  - When splitting an existing wall, keep the original wall index as one of the resulting segments and append any additional segments to the end.
- Vertex reuse is required for shared portal endpoints (portal endpoints must reference the same vertex indices on both sides).

#### E) Back-sector assignment rules
- Nested rooms: all new room boundary walls must have `back_sector` set to the enclosing sector id.
- External (adjacent) rooms: new room boundary walls default `back_sector = -1`, except the portal segment(s) created by wiring.

#### F) Room preview transforms (rotation + non-uniform scaling)
While the room preview is visible:
- Rotation: holding the platform-idiomatic “primary modifier” and pressing left/right arrow rotates the preview by 90° increments clockwise/counter-clockwise.
- Scaling: holding primary modifier + alt/option and pressing:
  - left/right scales along the horizontal view axis,
  - up/down scales along the vertical view axis.

(Platform-idiomatic modifier mapping is defined in Assumptions.)

#### G) Main-process atomic edit command
- Add a new typed atomic command to the map edit command system:
  - `map-edit/create-room`
- The renderer must request creation via `window.nomos.map.edit(...)` (L03).
- The command must be revision-gated, deterministic, undoable/redoable, and must reject invalid placements with typed errors.

#### H) Tests + docs
- Unit tests must cover all conditional paths introduced in new/changed **public** methods (L04).
- Update `docs/map-edit-command-system.md` and `docs/renderer-ui-system.md` to reflect the new Room tool and command (L09).

#### I) Player start editing (engine verification blocker)
- Add support for an optional map-root `player_start` object:
  - `{ x: number, y: number, angle_deg: number }`
- Expose this in the Inspector **Map Properties** section with a “target” pick button to set `(x,y)` by clicking in the map.
- Render a player-start marker (circle + vision cone) on the map canvas.

This is included in this Phase to enable out-of-band engine verification before closing Phase 0026.

### Out of scope
- Editing existing rooms as higher-level objects (move/resize/rotate after placement).
- Arbitrary polygon rooms beyond the 3 templates.
- Connecting a new room to multiple existing rooms in one placement.
- Joining to non-parallel / non-collinear boundaries (only collinear edge joins are supported).
- Automatic texture/theme selection UI; defaults are used.
- Adding map schema-level “rooms” as a persistent, first-class on-disk abstraction.

Note: player-start editing is in-scope as described above.

## Constraints
- **L01 (Cross-platform parity):** input handling must work on macOS/Windows/Linux.
- **L02 (Offline):** no network dependencies.
- **L03 (Electron security):** renderer cannot mutate JSON; creation must be a typed IPC command applied in main.
- **L04 (Testing):** new command + any new public helpers must have unit tests covering success/failure branches.
- **L08 (Design for testability):** placement validity and wiring computations must be implemented as pure helpers (deterministic; no Konva/Electron dependency).
- **L09 (Docs):** update relevant docs under `docs/`.

Style guide alignment (from `.ushabti/style.md`):
- Keep geometry policy and correctness rules in main/domain logic; renderer does interaction + feedback only.
- Avoid new dependencies; use small, focused modules.

## Assumptions (explicit)
- **Sector ids are authoritative** for walls’ `front_sector`/`back_sector` references in this editor (matches renderer view-model behavior).
- Default authored values for a newly created sector/walls are:
  - `floor_z = 0`, `ceil_z = 4`, `light = 1`
  - `floor_tex`, `ceil_tex`, and `wall.tex` are chosen from the **current project’s available texture assets** rather than hard-coded names.
    - Selection rule: take the **first 3 texture filenames** from `AssetIndex.entries` under `Images/Textures/`, after sorting lexicographically by `relativePath`.
    - Mapping rule: first texture => wall, second => floor, third => ceiling.
    - If fewer than 3 textures exist, room creation is rejected with a typed error (the engine requires non-empty texture strings).
  - To preserve determinism in `map-edit/create-room`, the renderer must compute these defaults from the snapshot and include them explicitly in the create-room command payload.
- “Primary modifier” mapping for input:
  - macOS: `Meta` (Command)
  - Windows/Linux: `Control`
- Snap threshold for “close to a wall” is **12 px** in screen space.
- Room creation targets the decoded/validated map model; if decoding fails, Room tool is effectively disabled (no preview, no creation).

## Acceptance criteria

### Tool + commands
- A Room tool button exists in the toolbox (pencil icon) and can be activated.
- With Room tool active, the tool bar exposes Rectangle/Square/Triangle commands, and the chosen command controls the preview.

### Preview + validity feedback
- With Room tool active and a template selected:
  - A preview outline tracks the mouse in world space.
  - Outline is green when placement is valid, red when invalid.
  - Clicking in an invalid state performs no edit and does not crash.

### Placement rules
- Nested placement:
  - A room can be created entirely inside an enclosing sector.
  - The new room’s walls have `back_sector` set to the enclosing sector id.
  - The new room does not intersect or overlap existing wall segments.
- Adjacent placement:
  - A room cannot be created “floating” in empty space.
  - A room can be created adjacent to an existing room only when within snap threshold of an eligible wall.
  - On adjacent creation, the editor snaps the room to the existing boundary and creates a portal connection by cutting edges as needed.

### Correctness enforcement
- The main-process `map-edit/create-room` command rejects invalid creation requests with typed errors and leaves the document unchanged.
- The command never reorders existing `walls[]` entries.
- Undo/redo fully reverses/applies the creation, restoring `json`, `dirty`, and `lastValidation` semantics consistent with the existing edit system.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Docs updated:
  - `docs/map-edit-command-system.md` documents `map-edit/create-room`.
  - `docs/renderer-ui-system.md` documents the Room tool interaction and key bindings.

## Risks / notes
- **Wall index stability:** Cutting an existing wall must not shift unrelated wall indices; this Phase explicitly forbids reordering.
- **Geometric robustness:** Segment intersection and “collinearity” checks must be tolerant of floating-point error (small epsilons) while remaining deterministic.
- **Validator mismatch risk:** The app does not run the external validator per edit; therefore the command must enforce enough invariants to prevent producing invalid maps.
