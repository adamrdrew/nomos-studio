# Phase 0035 Steps — Room Clone

## S001 — Confirm UX decisions and scope boundaries
- **Intent:** Remove ambiguity before changing command semantics.
- **Work:**
  - Confirm the Clone button behavior change is **sector-only** (sector selection triggers clone-placement; other selection kinds keep existing behavior).
  - Confirm cloning copies **geometry + sector/wall properties**, but not entities/doors/lights/particles.
  - Confirm handling for malformed/multi-loop sectors (disable cloning + user feedback).
- **Done when:** `phase.md` decisions remain accurate and unambiguous.

## S002 — Define a typed “room stamp” payload (geometry + properties)
- **Intent:** Make cloning/placement deterministic, testable, and reviewable.
- **Work:**
  - Define a `RoomStamp` / `StampRoomRequest` shape that includes:
    - polygon geometry (in local coordinates + transform, or already-world coordinates)
    - ordered per-edge wall property payloads (texture/toggles/end-level, etc.)
    - sector property payloads (floor/ceil z, textures, light, toggled-floor settings)
    - renderer-computed placement plan (nested/adjacent/seed) consistent with existing create-room request patterns
  - Specify required validations (min size, finite numbers, matching counts).
- **Done when:** A single payload contract is documented and ready to become an IPC type.

## S003 — Add pure helpers: sector boundary extraction → polygon + wall ordering
- **Intent:** Ensure the preview and main validation can agree on the same geometry ordering (L08).
- **Work:**
  - Add a deterministic helper that, given a sector id and map geometry, returns:
    - a single boundary polygon (vertex coordinates)
    - the corresponding ordered boundary wall references (for property alignment)
  - Handle “sector appears as backSector only” and orientation consistency.
  - Define explicit failure modes (no loop, ambiguous loop, non-simple loop).
  - Add unit tests for:
    - rectangle loop
    - concave loop
    - sector boundary defined by backSector edges
    - failure mode (malformed edges)
- **Done when:** Helper is pure, deterministic, and has branch-covering tests.

## S004 — Add pure helpers: stamp transforms for preview/placement
- **Intent:** Keep clone placement interaction identical to Room tool capabilities.
- **Work:**
  - Define how a buffered stamp is positioned under the cursor (anchor choice, e.g., centroid or bounding-box center).
  - Reuse existing Room tool rotate/scale semantics:
    - quarter-turn rotation about the stamp anchor
    - non-uniform scale along view axes
  - Add unit tests for transform correctness (rotation and scale branches).
- **Done when:** The clone preview can be produced from stamp+transform without Konva.

## S005 — Extend shared IPC command types with `map-edit/stamp-room`
- **Intent:** Make cloned-room placement a first-class, typed main-owned edit (L03).
- **Work:**
  - Extend `MapEditAtomicCommand` union with `kind: 'map-edit/stamp-room'` using the payload from S002.
  - Extend `MapEditError` codes with stamp-room failure reasons (invalid payload, invalid placement, malformed sector loop, etc.).
  - Ensure exhaustiveness checks are updated.
- **Done when:** TypeScript compiles and the new command is available end-to-end.

## S006 — Implement `map-edit/stamp-room` in `MapCommandEngine`
- **Intent:** Enforce the same invariants as create-room while copying properties.
- **Work:**
  - Validate the request payload (finite numbers, polygon size, property arrays match edge count).
  - Compute/validate placement against current JSON using existing room placement validity helpers.
  - For adjacent placement:
    - compute portal plan and snapped polygon
    - apply wall cutting / portal wiring per existing create-room guarantees
    - preserve existing wall index stability (no reordering)
  - Allocate new sector id deterministically and append sector/walls/vertices.
  - Apply sector/wall property copying while excluding identity/topology fields.
  - Return a selection effect selecting the new sector.
- **Done when:** Engine supports nested/adjacent/seed stamp placement with deterministic results and typed errors.

## S007 — Unit tests: `MapCommandEngine` stamp-room
- **Intent:** Satisfy L04 for the new public behavior.
- **Work:**
  - Add tests for success:
    - nested placement of a stamped concave polygon
    - adjacent placement producing a portal and preserving wall order
  - Add tests for failure:
    - payload malformed (mismatched wallProps count)
    - intersection rejection
    - no snap target / too far
    - non-collinear adjacency
  - Assert property carry-over (sector/wall fields) and new unique ids.
- **Done when:** Tests cover meaningful branches and pass.

## S008 — Renderer: clone buffer state and extraction from current selection
- **Intent:** Provide a stable paste buffer that drives preview.
- **Work:**
  - Add renderer-local state for the room clone buffer (cleared on map change).
  - On Clone-with-sector-selected:
    - extract boundary polygon + ordered walls
    - capture sector + wall properties into the buffer
- **Done when:** Buffer can be populated reliably for supported sectors.

## S009 — Renderer: command bar Clone action switches to Room tool with stamp preview
- **Intent:** Complete the user flow described in DoD.
- **Work:**
  - Update the Select tool’s Clone command handling:
    - if selection is sector: populate buffer, switch active tool to Room tool, set Room tool mode to “stamp from buffer”
    - if not: preserve existing clone behavior
  - Provide user feedback when cloning is unavailable (e.g., no sector loop).
- **Done when:** Manual run confirms the tool switch and stamp preview appears.

## S010 — Renderer: Room tool supports stamping a buffered polygon
- **Intent:** Make clone placement share the same validity/snap logic as template placement.
- **Work:**
  - Extend Room tool state to support two sources:
    - existing templates (rectangle/square/triangle)
    - buffered stamp polygon
  - Ensure preview uses the same validity pipeline:
    - compute candidate polygon under cursor
    - compute validity via shared geometry helpers
    - for adjacent, preview the snapped polygon when valid
  - On valid click, issue `window.nomos.map.edit(...)` with `map-edit/stamp-room`.
- **Done when:** Stamp placement works and mirrors existing room placement UX.

## S011 — Docs update (L09)
- **Intent:** Keep subsystem documentation accurate.
- **Work:**
  - Update `docs/renderer-ui-system.md` to document room clone workflow (clone buffer → Room tool stamp placement).
  - Update `docs/map-edit-command-system.md` to document `map-edit/stamp-room` contract, validations, and semantics.
- **Done when:** Docs match the intended implementation.

## S012 — Quality gates
- **Intent:** Keep repo green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All gates pass.
