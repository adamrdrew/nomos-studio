# Phase 0026 Steps — Room Geometry Creation

## S001 — Record current map geometry invariants (repo truth)
- **Intent:** Ensure room creation writes geometry compatible with the editor’s existing decode/picking/rendering conventions.
- **Work:**
  - Confirm (from existing code/docs) that `walls[].front_sector` and `walls[].back_sector` reference **sector ids** (not sector array indices).
  - Record how portal-ness is defined in-editor (`backSector > -1`).
  - Identify any existing constraints around wall order / door `wall_index` references.
- **Done when:** Notes in this Phase reference the exact modules and invariants to align with.

## S002 — Define the room placement contract + defaults
- **Intent:** Make behavior deterministic and reviewable before implementation.
- **Work:**
  - Specify a typed `CreateRoomRequest` payload: shape, anchor/center, dimensions, rotation (0/90/180/270), and any flags needed for snapping.
  - Lock in default authored sector/wall fields for newly created geometry.
    - Texture defaults must be per-project (engine supports multiple games).
    - Define deterministic selection from `AssetIndex.entries` (sorted) and require the renderer to pass the chosen `wallTex`, `floorTex`, `ceilTex` strings in the request so the main command stays deterministic.
  - Define constants: snap threshold px, rotation step, scale step, min size.
  - Define placement modes and their rules: nested vs adjacent.
- **Done when:** A single, explicit contract exists that main can validate independently of the renderer.

## S003 — Implement pure geometry helpers for preview + validation (domain)
- **Intent:** Keep correctness logic deterministic and unit-testable (L08).
- **Work:**
  - Add pure helpers to:
    - generate template polygons (rectangle/square/triangle) in local coordinates
    - apply rotation (90° steps) and non-uniform scaling
    - translate to the candidate world position
    - test segment intersection (candidate edges vs existing wall segments)
    - test containment (candidate polygon inside an enclosing sector)
    - compute candidate adjacent snap (nearest eligible wall, collinearity, overlap interval)
  - Return a structured validity result (valid/invalid + reason codes).
  - Add unit tests covering edge cases and epsilon behavior.
- **Done when:** Helpers are covered by unit tests and can drive preview validity without Konva/Electron.

## S004 — Extend shared IPC types with `map-edit/create-room`

- **Intent:** Make room creation an official, typed main-owned edit (L03).
- **Work:**
  - Extend `MapEditAtomicCommand` with `kind: 'map-edit/create-room'` and the payload from S002.
  - Extend `MapEditError` typing with new error codes for create-room failure modes.
  - Update exhaustiveness checks and any serialization boundaries.
- **Done when:** TypeScript compiles and the new union member is available end-to-end.

## S005 — Implement `map-edit/create-room` in `MapCommandEngine`
- **Intent:** Enforce validity centrally and keep edits atomic/deterministic.
- **Work:**
  - Validate JSON shapes (`vertices`, `sectors`, `walls` arrays) and request payload.
  - Determine placement mode:
    - nested: identify enclosing sector; reject if none
    - adjacent: find snap target wall; reject if none
  - Reject any placement that intersects/overlaps existing wall segments (except intended portal overlap).
  - Generate new sector id deterministically (e.g., max existing id + 1).
  - Append required vertices/walls/sectors with defaults.
  - For nested rooms: set all new walls `back_sector = enclosingSectorId`.
  - For adjacent rooms:
    - snap room edge to target wall
    - compute overlap interval
    - cut the longer edge(s) by inserting new vertices and splitting walls
    - set `back_sector` for the portal segment on both sides
  - Preserve wall index stability: do not reorder existing `walls[]` entries; append new split segments at end.
  - Return selection effect selecting the new sector.
- **Done when:** Engine produces valid, deterministic JSON and rejects invalid placements with typed errors.

## S006 — Unit tests: `MapCommandEngine` create-room
- **Intent:** Satisfy L04 for the new public behavior.
- **Work:**
  - Add tests for success cases:
    - nested rectangle
    - adjacent rectangle with portal wiring and wall cutting
  - Add tests for failure cases:
    - invalid JSON shapes (missing arrays)
    - intersects existing wall
    - adjacent but no snap target
    - non-collinear adjacency request
    - invalid dimensions (too small / negative)
  - Assert:
    - walls are not reordered
    - portal segments have correct `back_sector` values
    - vertex indices are in range and shared endpoints are reused
- **Done when:** Tests cover all major branches and pass.

## S007 — Unit tests: `MapEditService` integration
- **Intent:** Ensure history/dirty/revision behavior matches existing edits.
- **Work:**
  - Add integration tests verifying:
    - create-room success bumps revision, sets `dirty=true`, clears `lastValidation`
    - undo removes the created room geometry
    - redo re-applies it
    - stale baseRevision rejects without store/history mutation
- **Done when:** Tests pass and align with existing edit semantics.

## S008 — Add Room tool to renderer tool registry + toolbox button
- **Intent:** Expose Room tool as a first-class interaction mode.
- **Work:**
  - Extend `MapEditorToolId` and `MapEditorInteractionMode` with `room`.
  - Add a tool definition for Room with a pencil icon and no selection-affecting toolbar commands beyond room-shape selection.
  - Add toolbar commands for Rectangle/Square/Triangle.
- **Done when:** Room tool is selectable and the toolbar shows its commands.

## S009 — Implement Room tool preview rendering + click behavior
- **Intent:** Provide safe, immediate user feedback; only commit when valid.
- **Work:**
  - In `MapEditorCanvas`, when in Room mode:
    - compute candidate polygon under cursor
    - compute validity using the pure helper from S003
    - render preview outline in red/green
    - set cursor to `crosshair` when valid, `not-allowed` when invalid
  - On click:
    - if invalid: no-op
    - if valid: invoke `window.nomos.map.edit(...)` with `map-edit/create-room`
    - handle `map-edit/stale-revision` by refreshing snapshot and not auto-retrying
- **Done when:** Preview + click-to-create works without crashes.

## S010 — Implement modifier key behavior for rotate/scale
- **Intent:** Make room authoring efficient while remaining cross-platform.
- **Work:**
  - Add key handling while the preview is visible:
    - primary modifier + left/right: rotate by 90°
    - primary modifier + alt/option + left/right/up/down: non-uniform scale steps
  - Ensure key handling is platform-idiomatic and does not interfere with existing shortcuts.
- **Done when:** Rotation/scaling updates the preview deterministically and respects the tool’s validity rules.

## S011 — Docs update (L09)
- **Intent:** Keep subsystem documentation accurate.
- **Work:**
  - Update `docs/map-edit-command-system.md` to include `map-edit/create-room` shape, validation rules, and semantics.
  - Update `docs/renderer-ui-system.md` to document the Room tool, commands, preview feedback, and key bindings.
- **Done when:** Docs match implemented behavior.

## S013 — Fix adjacent placement preview (edge-based snap detection)
- **Intent:** Make adjacent room creation reachable in the UI by detecting proximity to an existing wall based on the candidate polygon boundary (not its center).
- **Work:**
  - Update the shared helper used by the renderer preview and main validation so that “nearest wall within threshold” is computed from the candidate polygon boundary (segment-to-segment distance), not the polygon bounding-box center.
  - Keep the public result shape the same (still returns `targetWallIndex` and `snapDistancePx`).
- **Done when:** With the Room tool active, placing a room just outside an existing sector and within the 12px snap threshold produces a green preview and allows click-to-create.

## S014 — Make Rectangle template default long-and-thin
- **Intent:** Ensure Rectangle feels distinct from Square and matches “hall” expectations.
- **Work:**
  - In the renderer Room tool state, set template-specific default sizes.
  - When switching templates, update the preview size to the template default (square stays square; rectangle defaults to a long-and-thin hall).
- **Done when:** Selecting Rectangle shows a long/thin preview by default; selecting Square shows an equal-width preview.

## S015 — Add Room tool keyboard hint text in the Map Editor command bar
- **Intent:** Make rotate/scale modifiers discoverable without reading docs.
- **Work:**
  - Add a small, non-interactive hint block rendered in white text in the upper-right of the Map Editor command bar (the toolbar above the canvas).
  - Show the current platform-idiomatic modifier labels:
    - macOS: Cmd + ←/→ rotates, Cmd + Option + arrows scales
    - Windows/Linux: Ctrl + ←/→ rotates, Ctrl + Alt + arrows scales
  - Only show the hint while the active tool is Room.
- **Done when:** When Room tool is active, the hint is visible in the command bar upper-right; when other tools are active, the hint is hidden.

## S016 — Allow seed room creation in an empty map
- **Intent:** Allow users to start a brand-new map by placing the first room, even though it is not nested or adjacent.
- **Work:**
  - Extend the shared placement validity and request contract to include a "seed"/"free" placement mode.
  - Renderer preview: when the map has no sectors/walls, allow placement as valid and send placement kind `room-placement/seed`.
  - Main engine: allow `room-placement/seed` only when the current map has no sectors/walls; create the room with exterior walls (no portal wiring).
  - Add unit tests for the new conditional path (allowed only on empty maps; rejected otherwise).
  - Update docs describing this exception to the connectivity rule.
- **Done when:** On an empty map, the Room tool shows green preview and allows click-to-create the first room; on non-empty maps, behavior remains nested/adjacent-only.

## S017 — Make New Map create an empty map document (enables seed-room workflow)
- **Intent:** Ensure the “seed room” rule is reachable in the actual UI by making File → New Map open a valid, empty map document instead of clearing the document entirely.
- **Work:**
  - Update the main-process New Map handler so it creates a new in-memory map document with empty `vertices`/`walls`/`sectors` arrays (and empty optional arrays), rather than setting `mapDocument` to null.
  - Prompt the user for a destination path up-front (Save dialog) so Save/unsaved-changes guard remains safe and functional.
  - Clear edit history and selection like current behavior.
- **Done when:** File → New Map results in an editable empty map (Room tool can create the first room via seed placement), and normal maps still support adjacent placement.

## S018 — Fix adjacent snap target selection in maps with portals/diagonals
- **Intent:** Ensure adjacent placement remains reachable as maps grow and contain portal walls and/or diagonal walls (triangles).
- **Work:**
  - Update shared placement validity so it only considers **eligible** snap target walls for adjacent placement:
    - ignore portal walls (`backSectorId > -1`), since main rejects them as join targets
    - ignore non-axis-aligned walls, since adjacent joins only support collinear axis-aligned boundaries
  - Add unit tests demonstrating the bug (nearest wall is diagonal/portal, causing adjacent placement to be rejected) and the fix (eligibility filtering restores valid adjacent placement).
- **Done when:** After creating multiple rooms (including triangles/portals), adjacent placement can still become valid (green preview) near an eligible outer wall, and tests cover the conditional paths.

## S019 — Allow adjacent placement when a target wall endpoint touches the interior of the new room edge
- **Intent:** Fix the remaining editor repro: attaching a larger room (e.g., square) to a shorter target wall (e.g., narrow hall end) must be valid without requiring the room to be scaled down.
- **Work:**
  - Update domain intersection handling used by adjacent placement validity so it allows **T-junction endpoint touches** where an endpoint of an existing wall lies on the interior of a candidate room edge (after snapping), while still rejecting true crossings.
  - Add a regression unit test in `src/shared/domain/mapRoomGeometry.test.ts` that models a narrow hall end wall and a larger square attaching to it.
- **Done when:** The new regression test passes and the full Jest suite remains green.

## S020 — Define player_start schema and shared command shape
- **Intent:** Add a deterministic, typed way to edit map-root `player_start` without weakening update-fields validation.
- **Work:**
  - Define map-root schema for `player_start`: `{ x: number, y: number, angle_deg: number }`.
  - Extend shared IPC `MapEditAtomicCommand` with `map-edit/set-player-start` carrying `{ x, y, angleDeg }` (or equivalent) and document JSON mapping to `angle_deg`.
- **Done when:** TypeScript compiles and the new command is available to renderer/main.

## S021 — Implement map-edit/set-player-start in MapCommandEngine
- **Intent:** Ensure player start edits are main-owned, validated, undoable, and safe.
- **Work:**
  - Validate payload numbers are finite.
  - Apply `player_start` onto the map root JSON object as `{ x, y, angle_deg }`.
  - Keep selection effect as `map-edit/selection/keep`.
- **Done when:** Unit tests pass for success + failure cases.

## S022 — Add Player Start controls to Map Properties section
- **Intent:** Allow authors to view/edit player start from the right-side Map Properties panel.
- **Work:**
  - Show X, Y, Angle (deg) values (with reasonable defaults when missing).
  - Add a target button that enters a temporary “pick player start” mode.
  - Clicking the button again cancels pick mode.
- **Done when:** UI shows the fields and can commit edits via IPC.

## S023 — Implement player start pick mode + canvas marker rendering
- **Intent:** Make the player start easy to place visually and ensure it is visible in the editor.
- **Work:**
  - In MapEditorCanvas, when in pick mode, interpret next click as player start (x,y) and commit via `map-edit/set-player-start`.
  - Render the player start marker as a circle plus a small vision cone indicating `angle_deg`.
- **Done when:** Clicking in the map updates player start and the marker renders in the correct place with correct orientation.

## S024 — Tests: MapCommandEngine set-player-start
- **Intent:** Satisfy L04 for the new public command behavior.
- **Work:**
  - Add tests for success (writes `player_start` object to root).
  - Add tests for invalid payload (non-finite numbers / wrong shapes) rejects.
- **Done when:** Jest passes and new branches are covered.

## S025 — Docs update (player start)
- **Intent:** Keep subsystem docs accurate (L09).
- **Work:**
  - Update `docs/map-edit-command-system.md` and `docs/renderer-ui-system.md` to include `player_start` and `map-edit/set-player-start`.
- **Done when:** Docs match implemented behavior.

## S026 — Repair Phase tracking artifacts (steps/progress consistency)
- **Intent:** Make Phase 0026 reviewable and auditable by ensuring tracking files accurately represent the completed work.
- **Work:**
  - Fix `progress.yaml` so it has **unique** step IDs (no duplicates), no merged/duplicated keys, and includes an entry for **S012**.
  - Fix `steps.md` so step IDs are unique (no repeated S005 headers) and ordered consistently.
  - Ensure `steps.md` and `progress.yaml` represent the same set of steps (1:1), with matching titles.
- **Done when:** `progress.yaml` and `steps.md` are consistent, unambiguous, and ready for Overseer review.

## S027 — Bugfix: adjacent placement for square and triangle rooms
- **Intent:** Ensure all room templates (rectangle/square/triangle) can be attached adjacently under the same eligibility/collinearity rules.
- **Work:**
  - Update domain adjacent portal planning to handle square/triangle joins correctly.
  - Add/maintain unit tests covering square/triangle adjacent placement.
- **Done when:** All shapes can attach adjacently and the Jest suite remains green.

## S028 — Remove final restriction on adjacent placement for squares/triangles
- **Intent:** Ensure adjacent placement does not fail when the new room edge is equal to or longer than the target wall.
- **Work:**
  - Update domain snap-target selection to compute proximity using segment-to-segment distance (polygon boundary), not a center-point heuristic.
  - Add/maintain unit tests covering the “edge longer than wall” adjacent placement case.
- **Done when:** Adjacent placement works for the square/triangle edge-length repro and tests remain green.

## S029 — Fix lint failure (react-hooks/exhaustive-deps) without regressing player start angle editing
- **Intent:** Restore `npm run lint` to green while preserving the player-start angle editing fix.
- **Work:**
  - Update `MapPropertiesSection` hook dependencies (or refactor to avoid unstable deps) so `react-hooks/exhaustive-deps` is satisfied.
  - Ensure the prior regression does not return: editing player start angle must not revert to 0 during typing.
- **Done when:** `npm run lint` passes with `--max-warnings=0`.

## S030 — Add missing unit tests for mapRoomGeometry exported helpers (L04 conditional paths)
- **Intent:** Satisfy L04 by covering the remaining conditional branches in exported domain helpers.
- **Work:**
  - Add tests for `computeRoomPlacementValidity` branches not currently covered (at minimum: `invalid-size` and nested `intersects-walls`).
  - Add tests for `computeAdjacentPortalPlan` error returns (`invalid-wall-index`, `non-collinear`, `no-overlap`) in addition to success.
  - Document (in progress notes) that `computeRoomPlacementValidity` returning `non-collinear` / `ambiguous` via portal planning is not reachable with the current eligibility filter (snap target selection requires a positive-length overlapping parallel edge, which also guarantees portal planning succeeds).
  - Use the Jest coverage output for `src/shared/domain/mapRoomGeometry.ts` to confirm those branches are exercised.
- **Done when:** Jest remains green and `mapRoomGeometry.ts` no longer reports uncovered lines for these branches.

## S031 — Expand MapCommandEngine create-room tests to cover remaining meaningful failure branches (L04)
- **Intent:** Ensure the public `MapCommandEngine.apply` behavior for `map-edit/create-room` is fully branch-covered for its meaningful validation outcomes.
- **Work:**
  - Add unit tests for remaining create-room failure modes that return distinct typed errors (e.g., `not-enough-textures`, `not-inside-any-sector`, and “door already bound to wall_index” invalid-request).
  - Ensure tests focus on our behavior (error codes + unchanged JSON) rather than library behavior.
- **Done when:** Jest remains green and the create-room command’s meaningful failure branches are covered.

## S012 — Quality gates + manual verification record
- **Intent:** Finish Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual verification checklist:
    - preview appears and tracks mouse
    - green vs red validity matches expected cases
    - nested room creation sets `back_sector` to enclosing sector id
    - adjacent room creation snaps + creates portal + does not reorder walls
    - invalid placements do nothing
    - undo/redo works
- **Done when:** Automated checks pass and verification is recorded in `review.md`.
