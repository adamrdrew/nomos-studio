# Phase 0008 Steps — Tool Bar

## S001 — Confirm command semantics and supported selection kinds
- **Intent:** Remove ambiguity so implementation and tests have stable targets.
- **Work:**
  - Record the Phase decisions:
    - Toolbar location: inside Map Editor panel, above the canvas.
    - “Center” centers viewport on world origin (0,0) without changing scale.
    - “Default Zoom” re-applies the same initial framing behavior used on map open (center + fit-scale).
    - Delete/Clone support only: lights, particles, entities, doors (walls/sectors deferred).
    - Clone offset: apply a small constant world-space offset (e.g., +16, +16) so the clone is visible.
- **Done when:** Decisions are recorded in `phase.md` and referenced by subsequent steps.

## S002 — Define typed tool + toolbar-command registry
- **Intent:** Make the toolbar open-ended and safe to extend.
- **Work:**
  - Introduce a small, typed model for tools and their toolbar commands (discriminated unions + exhaustive checks).
  - Ensure a new tool can be registered in one place with:
    - id
    - label/icon
    - interaction mode
    - toolbar command list
  - Keep UI rendering generic: it only iterates tool definitions.
- **Done when:** A single registry module exists and both the toolbox and toolbar can consume it.

## S003 — Implement Map Editor Tool Bar UI component
- **Intent:** Add the UX surface for tool-specific commands.
- **Work:**
  - Create a renderer component that renders a horizontal bar and a row of command buttons for the active tool.
  - Ensure layout does not overlap the existing toolbox overlay.
  - Buttons must have clear labels (and icons if consistent with existing UI patterns).
- **Done when:** Switching tools changes the toolbar buttons and the component is visually stable.

## S004 — Make selected tool state shareable
- **Intent:** Allow the toolbar and toolbox to stay in sync without prop-drilling or duplicated state.
- **Work:**
  - Store the currently selected tool in a single place (either:
    - a small renderer-local Zustand field, or
    - a single owner component that passes it to both Toolbox and Tool Bar).
  - Keep the state renderer-local (not in main `AppStore`).
- **Done when:** Toolbar and toolbox always reflect the same selected tool.

## S005 — Add a viewport control interface for pan/zoom commands
- **Intent:** Let toolbar commands invoke view operations without reaching into component internals.
- **Work:**
  - Expose a narrow, typed imperative interface from the map viewport (e.g., `zoomIn`, `zoomOut`, `resetView`, `centerOnOrigin`).
  - Ensure the interface is testable by keeping math/transform helpers pure where possible.
- **Done when:** Tool bar can trigger pan/zoom operations through the interface.

## S006 — Implement Zoom/Pan tool commands
- **Intent:** Deliver expected behavior for Zoom and Pan tools.
- **Work:**
  - Implement Zoom In / Zoom Out using a fixed factor or step, clamped to existing min/max zoom bounds.
  - Implement Default Zoom to re-apply initial framing behavior (center + fit-scale bounded).
  - Implement Center to center the viewport on world origin (0,0) without changing scale.
- **Done when:** Commands match the acceptance criteria and do not regress existing mouse-wheel zoom or pan-drag behavior.

## S007 — Design the map edit IPC contract for Delete/Clone
- **Intent:** Keep map mutation in main process while letting renderer request edits.
- **Work:**
  - Add a new IPC channel and typed request/response for a narrow set of edit commands:
    - delete selected light/particle/entity/door
    - clone selected light/particle/entity/door
  - Decide on a shared “map object reference” shape for requests and (for clone) return enough information for renderer to select the new clone.
- **Done when:** IPC types are defined end-to-end (shared IPC types, preload surface types, main handler signature).

## S008 — Implement main-process map edit service (Delete/Clone)
- **Intent:** Provide a testable, policy-rich map mutation entrypoint.
- **Work:**
  - Add an application service in `src/main/application/maps/` that:
    - validates prerequisites (map loaded)
    - applies the requested mutation to `MapDocument.json`
    - sets `dirty: true`
    - returns a typed result (success or error)
  - Implement safe clone behaviors:
    - append new entries (do not reuse indices)
    - generate unique door IDs deterministically with collision checks
- **Done when:** Service is callable from IPC and unit-tested for all conditional branches.

## S009 — Wire IPC → service → store → renderer refresh
- **Intent:** Make toolbar actions actually update the editor.
- **Work:**
  - Extend:
    - `src/shared/ipc/nomosIpc.ts` (new channel + types)
    - `src/preload/preload.ts` and `src/preload/nomos.d.ts` (new `window.nomos.map.*` method)
    - `src/main/ipc/registerNomosIpcHandlers.ts` (handler registration)
    - `src/main/main.ts` (handler implementation calling the new service)
  - Ensure the existing `nomos:state:changed` signal is emitted after successful edits so the renderer refreshes.
- **Done when:** Clicking Delete/Clone updates the map rendering via snapshot refresh.

## S010 — Renderer-side enable/disable + selection updates
- **Intent:** Keep UX safe and intuitive.
- **Work:**
  - Disable (or no-op safely) Delete/Clone when:
    - no map is loaded
    - no selection exists
    - selection kind is wall/sector (deferred)
  - After Delete: clear selection.
  - After Clone: select the newly created clone using the clone result returned from IPC.
- **Done when:** Buttons are not misleading and selection state remains consistent.

## S011 — Update subsystem docs (L09)
- **Intent:** Keep docs as the source of truth.
- **Work:** Update:
  - `docs/renderer-ui-system.md` (tool bar behavior and how it’s driven by tool definitions)
  - `docs/maps-system.md` (new map edit operation and main-process service)
  - `docs/ipc-system.md` (new IPC channel + contract)
  - `docs/app-store-system.md` if any snapshot/state behavior changes are introduced
- **Done when:** Docs match the implemented behavior and exposed API surface.

## S012 — Unit tests for new/changed public APIs (L04)
- **Intent:** Preserve safety and branch coverage.
- **Work:** Add/extend unit tests for:
  - the new main-process edit service (success + failure branches)
  - IPC handler wiring (request validation, error propagation)
  - any new public helper functions introduced for view transforms (if made public)
- **Done when:** Tests cover all conditional paths of new/changed public methods.

## S013 — Quality gates
- **Intent:** Ensure repository remains green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All gates pass.

## S014 — Complete L04 test coverage for new public APIs
- **Intent:** Satisfy L04 by covering all meaningful conditional paths in new public APIs.
- **Work:**
  - Extend `MapEditService` unit tests to cover remaining branches through `edit(...)`, at minimum:
    - delete for `particle` and `entity` targets
    - clone success for `particle` target
    - negative / non-integer index paths for indexed targets
    - door clone path where `"<id>-copy"` is available (no numeric suffix)
    - door clone invalid id (empty/whitespace) error
  - Add unit tests for exported tool registry helpers in `src/renderer/ui/editor/tools/mapEditorTools.ts`:
    - default tool id
    - `getMapEditorTool` success and failure behavior
- **Done when:** Added tests fail on regression and collectively exercise all meaningful branches of the public APIs.

## S015 — Align toolbar zoom focus with wheel zoom behavior
- **Intent:** Meet the zoom acceptance criteria: toolbar zoom should use the same focus behavior as wheel zoom.
- **Work:**
  - Extend the viewport API so toolbar zoom can zoom around a meaningful focus point consistent with wheel zoom (e.g., last-known pointer position when available, else fallback).
  - Update toolbar Zoom In/Out handlers to use that focus mechanism.
- **Done when:** Manual testing confirms toolbar Zoom In/Out behaves consistently with wheel zoom focus behavior.

## S016 — Clarify door clone visibility/offset semantics
- **Intent:** Resolve the remaining acceptance-criteria ambiguity for door cloning (doors have no x/y position to offset).
- **Work:**
  - Update `phase.md` to explicitly state that clone offset applies to x/y-bearing objects (lights/particles/entities).
  - Clarify that door clone behavior is “duplicate door record with a unique id” (and retains wall linkage), without attempting a positional offset.
- **Done when:** The Phase spec reflects the implemented semantics so review is unambiguous.

## S017 — Complete remaining MapEditService L04 branch coverage
- **Intent:** Satisfy L04 by covering the remaining meaningful conditional branches in `MapEditService.edit(...)` surfaced by Jest coverage.
- **Work:** Add/adjust unit tests to cover, at minimum:
  - `cloneIndexedWithOffset` when the collection is not an array (error propagation)
  - `cloneIndexedWithOffset` out-of-range index (source undefined) not-found branch
  - `cloneIndexedWithOffset` when the indexed entry is not an object (asRecord/asXyRecord failure)
  - door delete/clone when `doors` is not an array
  - door delete/clone with non-record entries present in `doors`
  - `ensureUniqueDoorId` multi-collision loop case (e.g., copy, copy-2 already exist)
- **Done when:** Jest coverage no longer reports uncovered meaningful branches for `MapEditService`.
