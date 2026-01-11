# Phase 0006 — Map View

## Intent
Implement the first functional **map viewer** inside the existing Map Editor panel: render the currently-open map (loaded via the existing maps system), support **pan/zoom** (already present), support **wireframe vs textured rendering**, and enable **selection** (Select tool) so clicking map objects shows their properties in the Properties panel.

Refine the viewer UX so that newly-opened maps reliably appear **centered** (not off-screen), at a **workable default scale**, with object markers that remain **readable at any zoom**.

Fix the remaining “Map View” gaps so **Textured** mode correctly displays floor/wall textures under the app’s **Content Security Policy (CSP)** (no blocked `blob:` images / grey placeholder boxes), and ensure **wall thickness** is tuned per render mode (thin in wireframe; appropriately visible in textured).

This Phase exists now because Phase 0005 established the editor shell and Konva canvas; Phase 0006 turns that shell into a usable viewer and sets up the minimal state + IPC wiring needed for future editing workflows.

## Scope

### In scope

- **Render the currently-open map in the Map Editor panel**
  - Use the `mapDocument.json` already loaded by the main-process maps system.
  - Build a renderer-side, typed “view model” from the JSON (post-validation) sufficient for rendering and hit-testing.

- **Pan/zoom remains functional**
  - Preserve existing interaction behavior (Pan/Zoom tools) from Phase 0005.

- **Map spawn/origin and initial framing**
  - When a map is opened, the map viewer must initialize its view transform so the user immediately sees the map (no “blank canvas” due to off-screen content).
  - The initial view must be centered such that **world-space (0,0)** corresponds to the **center of the Map Editor viewport**.
  - To ensure maps authored far from the raw origin still appear centered, the renderer may apply a *render-only* origin offset derived from the map’s bounds; this must not modify the underlying `MapDocument.json`.

- **Map/editor grid scale defaults**
  - The default zoom/scale must make typical maps readable without requiring immediate zooming.
  - The maximum zoom must be sufficient for close inspection of geometry on the largest current maps.
  - The grid must not dominate the view (i.e., it must not visually imply the map is tiny at reasonable zoom levels).

- **Zoom-invariant marker sizing**
  - Markers for entities/emitters/doors must remain a consistent, readable **screen-space** size across zoom levels (i.e., they must not become enormous at high zoom and obscure the map).
  - Hit-testing thresholds must remain consistent with the marker’s rendered size.

- **Wireframe vs Textured render modes**
  - Wireframe view draws:
    - sector outlines (and/or subtle fills)
    - wall segments
    - door markers
    - entities/emitters markers (see below)
  - Textured view draws:
    - sector floor textures
    - wall textures
    - (ceil textures are not required to be visualized in top-down view)

- **Textured rendering must work under CSP**
  - The renderer must be able to display textures without CSP violations.
  - If the current texture pipeline relies on `blob:` URLs (e.g., via `URL.createObjectURL`), the CSP must explicitly allow them via a narrowly-scoped `img-src` directive (do not broaden `default-src`).

- **Wall thickness tuning (wireframe vs textured)**
  - Wireframe walls must be drawn thin and readable.
  - Textured walls must be thick enough to show textures painting/repeating, without obscuring the map.

- **View menu items: Textured / Wireframe**
  - Add a **View** menu with items:
    - Wireframe
    - Textured
  - Selecting either item switches the map render mode immediately.

- **Render entities and emitters**
  - Render shapes at the correct `(x, y)` map coordinates:
    - light emitter: **circle**
    - particle emitter: **square**
    - entity placement: **triangle**
  - Light emitters include a **semi-transparent radius circle** tinted by the light’s color.

- **Selection + Properties display (Select tool)**
  - When the Select tool is active, clicking any map object (sector, wall, door, entity, emitter, etc.) sets it as the “selected object”.
  - The Properties panel displays that object’s properties (read-only; no editing in this Phase).

- **Validation-before-load UX (external validator)**
  - Ensure opening a map is blocked unless validation exits with code `0`.
  - If validation fails (non-zero), show an error dialog that includes:
    - the text `Map validation failed`
    - the validator output pretty-printed (JSON pretty print when parseable; otherwise raw text)

- **State synchronization for map open + view mode changes**
  - Introduce a minimal push mechanism so the renderer updates promptly when:
    - a map is opened in the main process
    - the render mode is changed via the View menu

- **Documentation updates (L09)**
  - Update relevant docs under `docs/` to describe the new behavior and API surface.

- **Testing (L04/L08)**
  - Add unit tests for any new/changed **public** methods and for all new conditional paths.

### Out of scope

- Map editing operations (drag vertices, split walls, paint textures, change sector heights, etc.).
- Transform tools beyond existing pan/zoom (rotate/scale/box-select).
- Persistence of view mode across app restarts (unless it already falls out naturally from existing settings patterns; otherwise defer).
- Complex sector topology support (holes/obstacles) beyond what is required to render typical maps.
- Renderer component tests (unless new renderer-facing public APIs are introduced that require tests per L04).

## Constraints

- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** process execution, asset reads, and menus must work on macOS/Windows/Linux.
  - **L02 (Offline):** textured rendering must use local assets; no network access.
  - **L03 (Electron security):** renderer must not access filesystem directly; texture/asset reads must be mediated via preload/IPC.
  - **L04 (Testing):** new/changed public methods must have unit tests covering conditional paths.
  - **L05 (Resource safety):** texture loading/caching must be bounded; no unbounded growth across map loads.
  - **L06 (System safety):** any asset read IPC must restrict paths to the configured assets directory.
  - **L08 (Testability):** filesystem/process/Electron dependencies must remain injectable behind adapters.
  - **L09 (Docs current):** update subsystem docs in the same change.

- Must follow `.ushabti/style.md`:
  - Maintain domain/application/infrastructure/UI boundaries.
  - Keep IPC surface minimal, typed, and narrowly-scoped.
  - Avoid new dependencies unless clearly justified.

## Acceptance criteria

- **Map renders in the Map Editor panel**
  - After opening a valid map via File → Open Map…, the Map Editor panel displays that map’s geometry.
  - Renderer updates without requiring app restart.

- **Pan/zoom still work**
  - Pan tool: click+drag pans the view.
  - Zoom tool: mouse wheel zooms the view.

- **Map spawn/origin and framing**
  - When a valid map is opened, the map content is visible immediately without the user panning.
  - The center of the Map Editor viewport corresponds to world-space (0,0) immediately after open.
  - Re-opening the same map re-applies the initial framing (the view does not depend on prior pan/zoom state).

- **Default scale and zoom bounds are usable**
  - The default zoom level makes the map readable without requiring immediate zoom.
  - The maximum zoom allows close inspection of walls/doors without the map feeling “capped” too early.
  - The grid remains a subtle orientation aid and does not overpower the map at default zoom.

- **Markers remain readable at any zoom**
  - Entity/particle/light/door markers do not grow unbounded with zoom.
  - At maximum zoom, markers do not obscure large portions of the map.

- **Wireframe render mode**
  - Wireframe mode is available and shows sector/wall geometry and markers.

- **Textured render mode**
  - Textured mode is available.
  - Floors render using the sector’s `floor_tex`.
  - Walls render using each wall’s `tex`.

- **Textured rendering is not blocked by CSP**
  - In Textured mode, textures load and render (no “grey box” placeholders).
  - Renderer console logs do not contain CSP violations blocking texture loads (e.g., refused `blob:` image loads).
  - The CSP change (if any) is narrowly scoped and does not relax script or remote-code restrictions.

- **Walls are appropriately thin/thick per mode**
  - In Wireframe mode, wall strokes appear thin and do not dominate the view.
  - In Textured mode, walls are thick enough to perceive the texture fill/repetition.
  - Selection/hit-testing for walls remains intuitive after thickness changes.

- **View menu toggles mode**
  - The application menu has a **View** menu with **Wireframe** and **Textured**.
  - Selecting an item switches the mode immediately.

- **Entities/emitters markers**
  - Light emitters render as a circle marker at `(x,y)` and a semi-transparent radius circle tinted by light color.
  - Particle emitters render as a square marker at `(x,y)`.
  - Entities render as a triangle marker at `(x,y)`.

- **Selection shows Properties**
  - With Select tool active, clicking a sector/wall/door/entity/emitter selects it.
  - The Properties panel displays the selected object’s properties (read-only).

- **Validation gating + error dialog**
  - If validator exits `0`, open proceeds.
  - If validator exits non-zero:
    - the map is not loaded
    - an error dialog is shown containing the text `Map validation failed`
    - the dialog includes the validator output as pretty text.

- **Quality gates**
  - `npm test` passes.
  - `npm run typecheck` passes.
  - `npm run lint` passes.

## Risks / notes

- **Texture resolution convention (confirmed).** Map wall/floor texture fields are *filenames only* (e.g., `CONCRETE.PNG`). For world geometry textures, resolve them under the configured assets directory at `Assets/Images/Textures/<filename>` (i.e., `<settings.assetsDirPath>/Images/Textures/<filename>`). This Phase must treat `settings.assetsDirPath` as the single source of truth for asset loading.

- **Renderer state is currently pull-based.** This Phase introduces a narrow push signal to refresh state after main-process actions (open map, change view mode) so the viewer is responsive without polling.

- **Konva textured strokes:** Konva supports pattern fills well; textured wall rendering may require representing walls as thin polygons instead of stroked lines.

- **Origin vs authored coordinates:** To satisfy “viewport center == world (0,0)” while still centering arbitrary maps, the renderer may treat the computed map-bounds center as the render-time origin. Properties must continue to show the authored/raw values.

- **Properties panel placement (confirmed):** Properties remains in the existing right-side Inspector and becomes functional.
