# Phase 0005 — Begin Editor UI Creation

## Intent
Introduce the first real editor UI shell: a DockView-based layout with a central map editor canvas (React Konva) and the first editor side panels (tool palette, Asset Browser, Properties).

This Phase exists now to establish a stable, extensible UI foundation that future phases can build on (map rendering, selection, entity editing, asset workflows) without breaking Electron security boundaries.

## Scope

### In scope

- **DockView layout (editor shell)**
  - Replace the current “bootstrap panel” DockView usage with an editor-oriented layout.
  - Create a central **Map Editor** area and a right-side **Inspector** panel.

- **Map Editor area (React Konva; no map rendering yet)**
  - Render a graph-paper style grid.
  - Support basic **pan** and **zoom** interactions.
  - No map geometry/entities are rendered in this Phase.

- **Tool palette (left, skinny/tall)**
  - Provide a skinny, tall tool palette on the left with buttons:
    - Select
    - Zoom
    - Pan
  - Tool selection influences interaction mode in the map editor (minimal behavior acceptable: select may be a no-op for now; pan/zoom must function).

- **Inspector panel (right) with collapsible sections**
  - Two collapsible panels:
    - **Asset Browser**
    - **Properties** (placeholder; no functional behavior yet)

- **Asset Browser (hierarchical directory browser)**
  - Displays a navigable, hierarchical view of the configured Assets directory.
  - If no Assets directory is configured in settings, show centered text:
    - `Configure Assets in Settings`
  - Lists items alphabetically by name (assumption: directories first, then files; both sorted case-insensitively).
  - Shows small, appropriate icons based on file type (at minimum: JSON, PNG/images, MIDI, soundfont; default icon for unknown).
  - Double-clicking a file opens it using the platform’s default file handler.

- **IPC/preload support for “open asset in OS”**
  - Add a narrowly-scoped IPC operation to request that the main process open a file (via OS default handler).
  - Validate inputs and enforce safety constraints (must be within the configured assets directory).

- **Documentation updates (L09)**
  - Update relevant subsystem docs under `docs/` to reflect the new UI and IPC surface.

- **Testing (L04/L08)**
  - Add unit tests for any new/changed public methods (especially main/preload/IPC service surfaces) covering conditional paths.

### Out of scope
- Actual map rendering (walls/sectors/entities), hit testing, selection behavior beyond basic tool mode toggles.
- Asset import/pipeline features, thumbnails/previews, drag-and-drop into the editor.
- Any new settings fields.
- Persistent UI layout saving/restoring (DockView serialization).
- Custom context menus, file operations (rename/delete), or search/filter in Asset Browser.
- Renderer component testing infrastructure beyond what is required by L04 (renderer UI components may remain untested unless they introduce new public APIs requiring tests).

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** behavior must work on macOS/Windows/Linux.
  - **L02 (Offline):** UI and asset browsing must not require network.
  - **L03 (Electron security):** renderer must not access Node/OS APIs directly; opening files must be mediated via preload/IPC.
  - **L04 (Testing):** new/changed public methods must have unit tests covering conditional paths.
  - **L06 (System safety):** do not open arbitrary paths; only open files under the user-configured assets directory.
  - **L08 (Testability):** wrap Electron `shell` and filesystem/path checks behind injectable adapters where needed.
  - **L09 (Docs current):** update subsystem docs in the same change.
- Must follow `.ushabti/style.md`:
  - preserve domain/application/infrastructure/UI boundaries
  - keep IPC surface minimal and typed
  - avoid introducing new dependencies unless essential (DockView, React Konva, Blueprint are already present)

## Acceptance criteria
- **DockView layout present**
  - In normal mode (not settings mode), the main window renders an editor layout with:
    - a central Map Editor area
    - a right Inspector panel

- **Tool palette present (left)**
  - A skinny/tall tool palette is visible on the left.
  - It has buttons for Select, Zoom, Pan.
  - Clicking a tool visibly changes the selected tool state (e.g., active styling).

- **Map Editor grid + pan/zoom**
  - The Map Editor area shows a graph-paper style grid.
  - Zoom works (mouse wheel or equivalent) and changes the scale of the grid.
  - Pan works (click+drag or equivalent) and changes the view offset.
  - Tool selection affects interaction mode at least as follows:
    - Pan tool enables click+drag panning.
    - Zoom tool enables wheel zooming (or makes zoom the primary interaction).
    - Select tool does not perform destructive actions (no-op is acceptable).

- **Inspector collapsibles**
  - The Inspector panel contains two collapsible sections: Asset Browser and Properties.
  - Properties section is present but can be empty/placeholder.

- **Asset Browser data behavior**
  - If `settings.assetsDirPath` is unset/null/blank, Asset Browser shows centered text `Configure Assets in Settings`.
  - If `settings.assetsDirPath` is set and an asset index exists, Asset Browser renders a hierarchical tree derived from the index.
  - Items are sorted alphabetically and display file-type icons.

- **Open asset on double-click**
  - Double-clicking a file item triggers a preload API call that causes the main process to open the file with the OS default handler.
  - The main process rejects attempts to open files outside the configured assets directory.

- **Docs updated**
  - `docs/renderer-ui-system.md` reflects the new editor shell/layout and the new editor UI components.
  - `docs/ipc-system.md` lists the new IPC channel and renderer-facing preload method.
  - `docs/assets-system.md` describes the Asset Browser’s use of the asset index and the “open asset” operation.

- **Quality gates**
  - `npm test` passes.
  - `npm run typecheck` passes.
  - `npm run lint` passes.

## Risks / notes
- **DockView UX vs “floating” tool palette:** This Phase will treat the tool palette as a left-anchored overlay within the Map Editor area (assumption), while DockView provides the primary panel layout.
- **Asset index size:** Rendering very large asset trees may need performance work later (virtualization). This Phase implements a correct baseline without adding extra UX features.
- **IPC safety:** Opening files is security-sensitive; the main process must validate both “assets configured” and “path is within base dir” before opening.
