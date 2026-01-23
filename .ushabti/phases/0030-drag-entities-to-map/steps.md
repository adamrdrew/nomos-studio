# Steps — Phase 0030 (Drag Entities to Map)

## S001 — Confirm current map entity JSON shape and selection behavior
- **Intent:** Ensure the new create/placement flow writes the same shape the renderer and engine already expect.
- **Work:**
  - Confirm the decoded map entity fields and JSON keys (`entities[].x`, `entities[].y`, `entities[].def`, `entities[].yaw_deg`).
  - Confirm current selection ref model for entities (`{ kind: 'entity', index }`).
  - Confirm whether `def` is intended to store engine-facing def name (preferred) vs manifest file path (legacy).
- **Done when:** The write-shape for `map-edit/create-entity` is recorded in the Phase notes and matches current decoder + engine assumptions.

## S002 — Decide and document sprite resolution rules
- **Intent:** Make thumbnail loading deterministic and resilient despite defs referencing only a sprite filename.
- **Work:**
  - Define a deterministic lookup strategy for `sprite.file.name` → asset relative path.
  - Proposed rule (to implement unless contradicted by repo reality):
    - Try prefixes in order: `Images/Sprites/`, `Assets/Images/Sprites/`.
    - If not found, fall back to scanning `assetIndex.entries` for the first entry whose basename equals the sprite filename (stable lexicographic order).
  - Define placeholder behavior when unresolved.
- **Done when:** A single resolution algorithm is written down (used by UI and tested in a pure helper).

## S003 — Add a new non-closable DockView panel: Entities
- **Intent:** Provide the required right-hand tab peer to Inspector.
- **Work:**
  - Add a new DockView panel component (e.g., `EntitiesDockPanel`).
  - Ensure it is created by `ensureCorePanelsPresent` and treated as non-closable.
  - Place it in the same right-side group as Inspector (tabbed peer behavior).
- **Done when:** The editor shows an **Entities** tab next to **Inspector**, and both remain present even if closed.

## S004 — Define pure parsers/types for entity manifest and entity defs
- **Intent:** Keep parsing logic testable (L08) and consistent with existing Inspector usage.
- **Work:**
  - Reuse or extract the existing manifest parser (`parseEntityManifestFiles`).
  - Add a pure parser for entity definition JSON that returns a minimal display model:
    - `entityName`
    - `spriteFileName`
    - `frameWidthPx` / `frameHeightPx`
  - Define explicit failure results (typed error union or `Result`).
- **Done when:** Parsing can be unit-tested without Electron/Konva/DOM.

## S005 — Implement Entities list loading flow (manifest → defs)
- **Intent:** Populate the Entities panel strictly from the manifest.
- **Work:**
  - In the Entities panel, load the manifest via `window.nomos.assets.readFileBytes` using the known path fallbacks.
  - For each manifest file entry, read and parse the corresponding def JSON.
  - Apply stable ordering (lexicographic by `entityName`, or by manifest order if that is the desired authoring order; choose and document).
  - Render clear loading + error states (manifest missing, invalid JSON, missing fields).
- **Done when:** The panel shows a stable list of entities in normal projects and does not crash on broken assets.

## S006 — Implement thumbnail rendering (first frame clip)
- **Intent:** Meet the UI requirement: show the first frame defined by `sprite.frames.dimensions`.
- **Work:**
  - Build a thumbnail component that:
    - resolves sprite asset path (per S002)
    - reads bytes via `window.nomos.assets.readFileBytes`
    - creates an `img` source (blob URL) and ensures URL cleanup (revoke on unmount / change)
    - clips to the first frame rectangle (0,0,w,h)
  - Ensure the component handles missing/invalid images with a placeholder.
- **Done when:** At least two example frame shapes render correctly (multi-frame strip and single-frame), and blob URLs are revoked.

## S007 — Add shared drag payload format for entity placement
- **Intent:** Make drag/drop robust and forwards-compatible.
- **Work:**
  - Define a single drag data MIME/type key (e.g., `application/x-nomos-entity-placement`).
  - Payload includes:
    - `defName` (entity def name to store in map `entities[].def`)
    - optional display metadata (for debugging only)
- **Done when:** Drag start sets the payload and drop target can validate/parse it deterministically.

## S008 — Add a new atomic command: `map-edit/create-entity`
- **Intent:** Allow a single undoable edit to append a new entity placement.
- **Work:**
  - Extend `MapEditAtomicCommand` in `src/shared/ipc/nomosIpc.ts` with:
    - `kind: 'map-edit/create-entity'`
    - `at: { x: number; y: number }`
    - `def: string` (engine-facing entity name)
    - `yawDeg?: number` (optional; defaults to 0)
  - Define selection effect: select newly created entity by index.
- **Done when:** Typecheck is green and the new command is part of the IPC union.

## S009 — Implement `map-edit/create-entity` in `MapCommandEngine`
- **Intent:** Apply entity creation deterministically and safely in main.
- **Work:**
  - Validate inputs:
    - `at.x/at.y` finite numbers
    - `def` non-empty trimmed string
    - `yawDeg` finite if present
  - Validate JSON shape:
    - root is object
    - `entities` is absent or an array
  - Append a new entity object:
    - `{ x, y, def, yaw_deg }`
  - Return selection effect to the new entity index.
- **Done when:** The command works end-to-end via IPC and creates the expected JSON.

## S010 — Add unit tests for `map-edit/create-entity` conditional paths
- **Intent:** Satisfy L04 for the new public command path.
- **Work:** Add tests covering:
  - Success when `entities` is missing (creates array)
  - Success when `entities` exists (appends)
  - Invalid inputs (non-finite numbers, empty `def`, invalid yaw)
  - Invalid JSON shapes (root not object, `entities` not array)
- **Done when:** Jest is green and all relevant branches are exercised.

## S011 — Implement drop target behavior on the map canvas
- **Intent:** Convert DOM drop coordinates into map world coordinates and enforce “sector-only” drop.
- **Work:**
  - Add drag-over / drop handlers to the Map Editor container.
  - Convert `clientX/clientY` to authored world point, respecting:
    - current view transform (pan/zoom)
    - map origin offsets used for rendering
  - Determine whether the point is in any sector using a pure helper (reuse picking sector test semantics).
  - While dragging:
    - show `not-allowed` cursor when outside sectors
    - show an allowed cursor when inside a sector
  - On drop:
    - if invalid, do nothing (no edit request)
    - if valid, call `window.nomos.map.edit({ baseRevision, command: create-entity })`
    - apply returned selection effect (select new entity)
- **Done when:** Dropping outside sectors is blocked; dropping inside a sector creates an entity at the correct spot.

## S012 — Asset refresh wiring for Entities list
- **Intent:** Ensure Entities panel stays up to date when assets are refreshed.
- **Work:**
  - Detect asset refresh via snapshot changes (e.g., `assetIndex.builtAtIso`) and re-run list loading.
  - Ensure in-flight loads are cancellable to prevent stale updates.
- **Done when:** Refreshing the asset index changes the Entities list without restarting the app.

## S013 — Update subsystem documentation (L09)
- **Intent:** Keep docs aligned with behavior and API surface.
- **Work:**
  - Update `docs/renderer-ui-system.md`:
    - new Entities panel
    - drag/drop behavior and sector-only constraint
  - Update `docs/map-edit-command-system.md`:
    - document `map-edit/create-entity` contract and selection semantics
  - Update any other affected doc if it becomes inaccurate.
- **Done when:** Docs match the implementation and command shapes exactly.

## S014 — Manual smoke + verification gates
- **Intent:** Confirm end-to-end UX and keep repo green.
- **Work:**
  - Manual smoke:
    - open Entities tab, confirm list loads
    - drag a known entity onto a sector; verify placement coordinates visually
    - attempt drop outside sector; verify blocked
    - undo/redo the placement
    - refresh asset index and confirm list updates
  - Run: `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`.
- **Done when:** UX behaves as specified and all checks pass.

## S015 — Fix `map-edit/create-entity` end-to-end acceptance in MapEditService
- **Intent:** Unblock entity placement by ensuring the new command is accepted by the edit service and returns an applied result with correct selection.
- **Work:**
  - Update `MapEditService.edit(...)` to recognize `map-edit/create-entity` as a supported command kind.
  - Ensure selection handling is correct:
    - the command should return `map-edit/applied` like other atomic edits
    - selection should be driven by the command engine’s returned selection effect (select new entity)
  - Add/extend unit tests to cover the new command kind through `MapEditService`.
- **Done when:** Drag-drop placement no longer fails with unsupported-target and unit tests cover the new branch.

## S016 — Fix sector-only drop validity (no “valid everywhere”)
- **Intent:** Ensure entity drops are only considered valid when the cursor is inside a sector polygon.
- **Work:**
  - Change sector containment used by drag-over/drop to use the same sector loop polygon used for floor rendering (buildSectorLoop + point-in-polygon).
  - Ensure points outside any sector return invalid and do not call `map.edit`.
  - Add unit tests for the new sector containment helper.
- **Done when:** The cursor is only valid over sectors and unit tests cover inside/outside behavior.

## S017 — Fix entity thumbnails and drag ghost preview
- **Intent:** Make thumbnails stable and correctly clipped/scaled; ensure the drag preview is a 64×64 crop (upper-right) as requested.
- **Work:**
  - Replace thumbnail rendering with a deterministic canvas render of the first frame crop (0,0,w,h) scaled to fit within the square.
  - Add a per-row drag image element and call `dataTransfer.setDragImage(...)` to use a 64×64 upper-right crop of the sprite sheet.
  - Ensure any created object URLs are revoked (L05).
- **Done when:** Thumbnails no longer overflow/misalign and drag image is a 64×64 upper-right crop.

## S018 — Ensure Entities tab is not active by default
- **Intent:** Keep Entities available but do not auto-open/select it on startup.
- **Work:**
  - After adding core panels, explicitly activate the Inspector panel.
  - Add a small unit test if there is an existing pattern for Dockview layout initialization tests; otherwise keep change minimal.
- **Done when:** The default right-side active tab is Inspector (Entities not selected) on startup.
