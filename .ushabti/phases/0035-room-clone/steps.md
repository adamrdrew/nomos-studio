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

## S008A — Renderer: Room tool can preview a buffered stamp (no commit yet)
- **Intent:** Make tool switching verifiable without depending on the full stamp placement edit.
- **Work:**
  - Extend the Room tool preview pipeline to accept an optional buffered stamp polygon source.
  - Render the stamp polygon outline under the cursor (translated so its anchor is under the cursor).
  - Reuse the existing validity coloring (green/red) using the same `computeRoomPlacementValidity(...)` path.
  - Do not issue any map edit on click yet (preview-only).
- **Done when:** With a non-null buffer, Room mode shows a translated preview with correct green/red validity.

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

## S013 — Bugfix: boundary extraction ignores internal same-sector walls
- **Intent:** Reduce spurious clone failures when a sector contains walls that are not part of the boundary loop.
- **Work:**
  - Update sector boundary directed-edge construction to ignore walls where `frontSectorId === sectorId && backSectorId === sectorId`.
  - Add unit test coverage demonstrating that a simple boundary loop can still be extracted even when a same-sector internal wall exists.
- **Done when:** Clone no longer fails on sectors with internal same-sector walls; tests cover both the new branch and existing failure reasons.

## S014 — Bugfix: add a clear escape hatch from stamp mode
- **Intent:** Ensure the Room tool never gets “stuck” in stamp mode, and template placement remains usable.
- **Work:**
  - Clear `roomCloneBuffer` when selecting a room template (rectangle/square/triangle).
  - Clear `roomCloneBuffer` on successful stamp-room placement.
  - Add `Escape` key behavior in Room mode: when a clone buffer is active, pressing Escape clears the buffer (cancel stamp).
- **Done when:** User can always exit stamp mode (template selection or Escape) and place template rooms normally.

## S015 — Quality gates (post-bugfix)
- **Intent:** Keep repo green after bugfixes.
- **Work:** Run Jest + typecheck + lint.
- **Done when:** All gates pass.

## S016 — Bugfix: boundary extraction prefers frontSector edges to avoid portal twin walls
- **Intent:** Fix clone failing with “open-loop” on valid rooms when portal walls exist in both directions (one wall record per sector).
- **Work:**
  - Update sector boundary edge construction to **prefer** `frontSectorId === sectorId` edges.
  - Only consider `backSectorId === sectorId` edges if the sector has **no** `frontSectorId === sectorId` edges (legacy/odd maps).
  - Add unit test coverage for a portal pair (two wall records, `A->B` and `B->A`) ensuring sector A’s loop extraction does not double-count.
- **Done when:** Cloning a connected room no longer fails with `open-loop`, and tests cover the new branch behavior.

## S017 — Quality gates (post-open-loop fix)
- **Intent:** Keep repo green after open-loop bugfix.
- **Work:** Run Jest + typecheck + lint.
- **Done when:** All gates pass.

## S018 — Bugfix: stamp-room accepts existing empty texture fields and logs actionable errors
- **Intent:** Fix real-world clone placement failures where existing maps may use empty strings for wall/sector textures, and make failures diagnosable.
- **Work:**
  - Relax `map-edit/stamp-room` request validation to accept texture fields that are strings (including empty), mirroring existing map JSON allowances.
    - `wallProps[i].tex` must be a string (empty allowed).
    - `sectorProps.floorTex` / `sectorProps.ceilTex` must be strings (empty allowed).
  - Update renderer stamp-room failure logging to print `code` and `message` (and stringify the full error) so Electron log forwarding does not collapse objects to `[object Object]`.
  - Add unit test coverage proving stamp-room succeeds with empty texture strings.
- **Done when:** Clone stamp placement no longer fails due to empty texture strings, and tests cover the new validation branch.

## S019 — Quality gates (post-stamp-room fix)
- **Intent:** Keep repo green after stamp-room bugfix.
- **Work:** Run Jest + typecheck + lint.
- **Done when:** All gates pass.

## S020 — Bugfix: MapEditService accepts and routes map-edit/stamp-room
- **Intent:** Fix runtime failures where the renderer issues `map-edit/stamp-room` but the main-process service rejects it as unsupported.
- **Work:**
  - Update `MapEditService.edit(...)` command-kind allowlist to include `map-edit/stamp-room`.
  - Ensure selection bookkeeping treats `map-edit/stamp-room` like other “applied” commands.
  - Add/extend unit tests proving `MapEditService` no longer returns `map-edit/unsupported-target` for `map-edit/stamp-room`.
- **Done when:** Clone placement reaches the command engine and does not fail with `unsupported-target`.

## S021 — Quality gates (post-MapEditService wiring)
- **Intent:** Keep repo green after wiring fix.
- **Work:** Run Jest + typecheck + lint.
- **Done when:** All gates pass.

## S022 — Bugfix: stamp-room emits schema-compatible wall fields (omit null/default optionals)
- **Intent:** Fix external map validation failures by ensuring stamped wall records match the on-disk schema expectations (optional fields omitted rather than written as null/defaults).
- **Work:**
  - Update stamp-room wall record construction so optional wall fields are only included when meaningful:
    - Omit `toggle_sector_id` when null.
    - Omit `toggle_sound` / `toggle_sound_finish` when null.
    - Omit `end_level`, `toggle_sector`, `toggle_sector_oneshot` when false (optional).
  - Add unit test coverage asserting that, for a default wall props payload, the resulting wall JSON does not include these keys.
- **Done when:** Stamped rooms no longer break external validation due to optional/null wall fields, and tests cover the new branch.

## S023 — Quality gates (post-schema compatibility fix)
- **Intent:** Keep repo green after the schema compatibility fix.
- **Work:** Run Jest + typecheck + lint.
- **Done when:** All gates pass.

## S024 — Add missing unit test coverage for room stamp transform helpers (L04)
- **Intent:** Satisfy L04 for the public helper functions in `mapRoomStampTransform`.
- **Work:**
  - Extend `src/shared/domain/mapRoomStampTransform.test.ts` to cover:
    - `computePolygonBounds(...)` null cases (empty polygon; non-finite coords)
    - `computePolygonAnchor(...)` null case (empty polygon) and normal case
    - `transformStampPolygon(...)` quarter-turn branches for `rotationQuarterTurns: 0 | 1 | 2 | 3` (at minimum)
      - Include at least one non-trivial scale + translation assertion for each rotation.
- **Done when:** Tests cover all meaningful conditional paths driven by `rotationQuarterTurns` and null/edge cases for bounds/anchor.
