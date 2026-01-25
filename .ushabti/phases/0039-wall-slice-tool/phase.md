# Phase 0039 — Wall Slice Tool (Split)

## Intent
Add a new map editor tool named **Split** (scissors/cut icon) that lets the user click a point on a wall to split that wall into two walls at the clicked point.

This Phase exists now because wall splitting is already a proven primitive inside the maps subsystem (e.g. portal endpoint splitting for adjacent room creation), but the editor lacks a direct authoring affordance for manual topology refinement.

## Scope

### In scope

#### A) Renderer: Split tool in the left tool bar
- Add a new tool in the left tool bar:
  - **Label:** `Split`
  - **Tooltip:** `Split wall`
  - **Icon:** scissors / cut (see Constraints/notes for implementation options)
- The tool must be selectable via the existing tool selection mechanisms (click + hotkeys index system).

#### B) Renderer: wall click → split request
- When the Split tool is active and the user clicks a wall (within the existing wall hit threshold), the renderer issues exactly one main-process edit that splits the wall at the intended point.
- The split point must be deterministic:
  - Use the closest point on the wall segment to the pointer world point (projection onto the segment).
  - Reject/ignore clicks that do not hit a wall.
- The renderer must not mutate map JSON directly (L03); it must use typed `window.nomos.map.edit(...)`.

Additional UX affordances:
- When Split is active, the wall to be acted on is highlighted on hover (like Select hover).
- The cursor becomes `crosshair` when hovering over a splittable wall and `not-allowed` otherwise.

#### C) Main: new atomic command to split a wall
- Add a new `MapEditAtomicCommand`:
  - `kind: 'map-edit/split-wall'`
  - `wallIndex: number`
  - `at: { x: number; y: number }`
- Semantics:
  - Validate `wallIndex` is in range, and `at.x/at.y` are finite.
  - Compute the closest point on the target wall segment.
  - If the split point is too close to either endpoint (epsilon), do not create degenerate zero-length walls.
  - Add (or reuse) a vertex at the split point.
  - Update the existing wall **in place** to become one segment.
  - Append a new wall entry for the other segment.
  - Preserve wall index stability: no reordering of `walls[]`.
  - Preserve wall properties by copying from the original wall record (texture, sector refs, toggle properties, etc.)

#### D) Undo/redo and selection effect
- The split operation must be undoable/redoble through the existing history.
- Selection effect must be explicit and deterministic.

#### E) Documentation updates (L09)
- Update the map edit command system doc to include the new atomic command and its validation/semantics.
- Update the renderer UI docs to include the Split tool behavior.

#### F) Testing (L04/L08)
- Add unit tests for:
  - The new command behavior in main (`MapCommandEngine` paths/branches).
  - Any new exported pure helpers added in renderer for hit/split-point computations.

### Out of scope
- Splitting multiple walls in one gesture (no drag-to-slice).
- Snapping the split point to grid or to existing vertices beyond the closest-point projection.
- Advanced selection UX (e.g., choosing which resulting segment is selected via modifier keys).
- Any map schema migration.

### Assumptions (recorded for Builder/Overseer)
- **Portal/door safety:** Initially, Split only operates on walls that are not portal walls and are not door-bound. Concretely:
  - If `wall.back_sector > -1` (portal wall), the command rejects with a typed `invalid-request` style error.
  - If a door references `wallIndex`, the command rejects.
  (If you want portal splitting supported, it should be planned explicitly because it affects door invariants.)
- **Selection effect:** After a successful split, selection becomes `{ kind: 'wall', index: wallIndex }` (the original wall index remains valid and now refers to one of the segments).
- **Epsilon:** Endpoint proximity is treated as “no split” using a small world-space epsilon (e.g. `1e-6`) to avoid degenerate segments.

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** identical behavior across macOS/Windows/Linux.
  - **L03 (Electron security):** edits happen only via preload/typed IPC.
  - **L04 (Testing):** new/changed public methods have unit tests covering all conditional paths.
  - **L08 (Testability):** hit-testing and split-point math should be isolated behind pure helpers.
  - **L09 (Docs current):** docs updated alongside behavior.
- Must follow `.ushabti/style.md`:
  - Keep domain logic out of renderer components.
  - Avoid new dependencies unless clearly necessary.

## Acceptance criteria

### Tool presence
- Split appears in the left tool bar with label `Split`, tooltip `Split wall`, and a scissors/cut icon.

### Split behavior
- With Split active, clicking a wall splits it into two walls at the clicked point.
- Split point is the closest-point projection onto the wall segment (deterministic).
- No degenerate walls are created (no zero-length segments).
- Wall properties (sector refs, textures, toggles, etc.) are preserved across both resulting segments.
- Undo/redo restores the pre-split topology exactly.

### Docs + quality gates
- Docs updated (L09): map-edit command system + renderer UI tool behavior.
- `npm run lint`, `npm run typecheck`, and `npm test` pass.

## Risks / notes
- **Icon implementation:** Blueprint may not provide an exact scissors/cut icon; a small local SVG icon may be required.
- **Door/portal invariants:** Splitting portal walls may require decisions about doors and portal semantics; intentionally deferred behind command validation.
- **User intent near endpoints:** Clicks near endpoints must not create confusing “almost zero” segments; renderer should avoid sending a command when the computed split point is too close to an endpoint.
