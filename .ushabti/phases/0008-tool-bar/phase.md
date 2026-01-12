# Phase 0008 — Tool Bar

## Intent
Add a **tool bar** above the Map Editor canvas that shows **tool-specific commands** for the currently selected tool (Select / Zoom / Pan).

This Phase exists now because Phases 0005–0007 established the Map Editor surface, toolbox, selection, and view controls. A tool bar is the next UX affordance needed to make tools feel “real” and to provide an extensible place for per-tool commands as additional tools are introduced.

## Scope

### In scope

- **Tool bar UI in the Map Editor panel**
  - Render a horizontal bar above the map viewport (within the Map Editor Dock panel).
  - The tool bar’s contents change based on the currently selected tool.

- **Open-ended tool → commands architecture**
  - Introduce a small, typed “tool definition” model where each tool declares its toolbar commands.
  - The Map Editor renders tool bar items by iterating tool definitions (avoid hard-coded `switch` trees in the UI).
  - Design must make adding a new tool with new toolbar commands:
    - easy (single place to register)
    - safe (typed, exhaustive)

- **Tool bar commands for existing tools**
  - **Select tool:** Delete, Clone
  - **Zoom tool:** Zoom In, Zoom Out, Default Zoom
  - **Pan tool:** Center

- **Zoom + pan commands wired to the map viewport**
  - Provide a clean interface for the tool bar to invoke view operations on the map viewport.
  - Zoom In/Out change the view scale in predictable steps and preserve the user’s focus (do not jump to unrelated coordinates).
  - Default Zoom re-applies the map’s initial framing behavior (same intent as map-open framing) so it is deterministic and useful.
  - Center centers the viewport on world-space origin (0,0) without changing scale.

- **Delete/Clone implemented through main-process map mutation (security boundary)**
  - The renderer must not mutate map files or main state directly (L03).
  - Add a narrow, typed map edit IPC operation that requests a specific mutation.
  - The main process mutates the in-memory `MapDocument.json`, marks `dirty: true`, and emits the existing `nomos:state:changed` signal so the renderer refreshes.

- **Supported Delete/Clone targets (Phase decision)**
  - Delete/Clone apply only to **placeable / list-like objects** that can be safely removed/duplicated without complex topology updates:
    - lights
    - particles
    - entities
    - doors
  - When the current selection is a wall or sector, Delete/Clone are disabled (or no-op with a clear, non-crashing behavior).

- **Documentation updates (L09)**
  - Update relevant subsystem docs under `docs/` to reflect the new UI behavior and new IPC surface.

- **Testing (L04/L08)**
  - Add unit tests for any new/changed **public** methods (especially the new main-process map edit service and IPC contract) covering conditional paths.

## Phase decisions (S001)

- **Toolbar location:** Inside the Map Editor panel, rendered above the map canvas.
- **Pan command:** **Center** centers the viewport on world-space origin $(0,0)$ without changing the current scale.
- **Zoom command:** **Default Zoom** re-applies the map-open initial framing behavior (viewport center at world $(0,0)$ plus bounded fit-to-map scale).
- **Select commands supported selection kinds:** Delete/Clone apply only to `light`, `particle`, `entity`, and `door` selections. Wall/sector edits are deferred.
- **Clone offset:** Clones are placed with a constant world-space offset of $(+16,+16)$ from the source object so the clone is visible.
- **Clone offset applicability:** The $(+16,+16)$ offset applies to x/y-bearing objects (lights/particles/entities). Doors do not have x/y position in this editor model; door clone duplicates the door record with a new unique id while retaining its wall linkage.

### Out of scope

- Keyboard shortcuts for toolbar commands.
- Undo/redo.
- Multi-select.
- Structural geometry edits (walls, sectors, vertices), including any edit that would require renumbering indices or retopologizing.
- Persisting selected tool or view transform across app restarts.

## Constraints

- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** all behavior must be platform-agnostic.
  - **L03 (Electron security):** renderer invokes edits via typed preload/IPC only.
  - **L04 (Testing):** new/changed public methods must have unit tests covering conditional paths.
  - **L06 (System safety):** “Delete” edits the in-memory map document; it must not delete files or perform destructive filesystem operations.
  - **L08 (Testability):** side effects remain behind injectable adapters; services are unit-testable.
  - **L09 (Docs current):** update subsystem docs for new behavior/API.

- Must follow `.ushabti/style.md`:
  - keep UI logic in renderer; state mutation in application services
  - prefer typed discriminated unions and exhaustive handling
  - avoid new dependencies

## Acceptance criteria

- **Tool bar is visible and located correctly**
  - The Map Editor panel shows a horizontal tool bar above the map canvas.
  - The tool bar does not overlap the toolbox and does not cover the canvas interaction area.

- **Tool bar contents change with selected tool**
  - Select tool shows: Delete, Clone.
  - Zoom tool shows: Zoom In, Zoom Out, Default Zoom.
  - Pan tool shows: Center.

- **Open-ended design**
  - Tool bar items are driven by a typed tool-definition registry (no scattered per-tool conditionals across multiple components).
  - Adding a new tool and its toolbar commands requires updating a single registry module and does not require editing the toolbar rendering logic.

- **Zoom tool commands behave as expected**
  - Zoom In increases view scale by a fixed step/factor while maintaining the current pointer/viewport focus behavior used by wheel zoom.
  - Zoom Out decreases view scale by the same step/factor.
  - Default Zoom re-applies deterministic initial framing behavior:
    - centers the viewport on world (0,0)
    - sets scale to the same bounded “fit to map” scale used when opening a map (or a deterministic default when no map is loaded)

- **Pan tool command behaves as expected**
  - Center centers the viewport on world (0,0) without changing the current scale.

- **Select tool commands behave as expected (supported targets)**
  - With a map loaded and a selected **light/particle/entity/door**:
    - Delete removes that object from the map document, clears selection, and sets `dirty: true`.
    - Clone duplicates that object, selects the clone, and sets `dirty: true`.
      - For x/y-bearing objects (lights/particles/entities), the clone is placed with a small world-space offset so it is visible.
      - For doors, the clone retains its wall linkage and differs by a new unique id.
  - With no map loaded or no selection:
    - Delete and Clone do not crash; they are disabled or no-op.
  - With a selected wall/sector:
    - Delete and Clone are disabled or no-op (explicitly deferred).

- **IPC + state refresh**
  - Map edits are requested through a typed preload/IPC operation.
  - After an edit, the renderer refreshes via the existing `nomos:state:changed` signal and the map view updates.

- **Quality gates**
  - `npm test` passes.
  - `npm run typecheck` passes.
  - `npm run lint` passes.

## Risks / notes

- **Selection type is renderer-local today.** The edit IPC will need a shared, typed “map object reference” (or command-specific payload) without leaking renderer-only types into shared domain.
- **Door cloning requires unique IDs.** The main-process edit service must generate a deterministic, collision-safe copy id (e.g., `"<id>-copy"`, with numeric suffixes if needed).
- **Structural edits are intentionally deferred.** Walls/sectors/vertices require topology-aware updates and will be planned as a separate Phase.
