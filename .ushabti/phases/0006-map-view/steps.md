# Phase 0006 Steps — Map View

## S001 — Confirm map JSON fields and texture/asset conventions
- **Intent:** Remove ambiguity so rendering + texture resolution are deterministic.
- **Work:**
  - Confirm which map keys are expected in practice for this editor (at minimum: `vertices`, `sectors`, `walls`, plus optional `lights`, `particles`, `entities`, `doors`).
  - Record the agreed texture resolution rule for world geometry:
    - Map texture fields are filenames (e.g., `CONCRETE.PNG`).
    - Resolve to `<settings.assetsDirPath>/Images/Textures/<filename>`.
  - Record that Properties stays in the existing right-side Inspector panel.
- **Done when:** These conventions are documented in this Phase and used by subsequent steps.

## S002 — Add a narrow main→renderer “state changed” signal
- **Intent:** Ensure the renderer updates promptly after map open and view-mode changes.
- **Work:**
  - Add a minimal, typed event channel in preload for “state changed”.
  - In main, emit this signal after mutating `AppStore` state relevant to the renderer (at least map open; render mode changes if stored in main).
  - In renderer, listen for the signal and call `useNomosStore.refreshFromMain()`.
- **Done when:** Opening a map via menu updates the renderer UI without restart or manual refresh.

## S003 — Add map render mode state + View menu items
- **Intent:** Provide user-controlled switching between wireframe and textured views.
- **Work:**
  - Introduce a `MapRenderMode = 'wireframe' | 'textured'` state source-of-truth (prefer main `AppStore` so menu + renderer stay consistent).
  - Extend the menu template to include a View menu with Wireframe/Textured options (radio/checked behavior).
  - Thread render mode into the renderer snapshot and store.
- **Done when:** View → Wireframe/Textured toggles mode immediately and stays consistent with current checked menu item.

## S004 — Create a typed renderer map view model + decoder
- **Intent:** Convert `MapDocument.json: unknown` into a safe, typed structure suitable for rendering and hit-testing.
- **Work:**
  - Define a minimal domain model (vertices, sectors, walls, doors, lights, particles, entities).
  - Implement a decoder function that validates expected shapes/types and returns a typed `Result`.
  - Ensure decoder errors are surfaced clearly (but do not change external validation behavior).
- **Done when:** Renderer can obtain a typed `MapViewModel` from `mapDocument.json` or a typed decode error.

## S005 — Render wireframe geometry (sectors/walls/doors)
- **Intent:** Make the map viewable as a correct, readable wireframe.
- **Work:**
  - Render walls as segments in world space transformed by the existing view transform.
  - Render sector boundaries (either via derived loops or by rendering all `front_sector` walls grouped by sector).
  - Render doors in wireframe mode as an overlay marker bound to the referenced wall index.
- **Done when:** A typical map displays correctly in wireframe and remains responsive during pan/zoom.

## S006 — Render entity/emitter markers (and light radius)
- **Intent:** Visualize authored gameplay objects.
- **Work:**
  - Draw marker shapes at map coordinates:
    - light: circle marker
    - particle: square marker
    - entity: triangle marker
  - Draw light radius as a semi-transparent circle tinted by light color and sized by radius.
- **Done when:** Markers appear at correct positions and scale appropriately with zoom.

## S007 — Implement hit-testing + selection state
- **Intent:** Enable clicking map objects and showing their properties.
- **Work:**
  - Add hit-testing in Select mode for:
    - markers (entities/emitters)
    - walls (distance-to-segment threshold in screen space)
    - doors (hit-test on their marker / bound wall)
    - sectors (point-in-polygon using sector boundary)
  - Define selection priority rules (e.g., markers > doors > walls > sector).
  - Store selected object in renderer state as a discriminated union including enough identity to re-derive properties.
- **Done when:** Clicking objects selects the expected target without affecting pan/zoom tool behavior.

## S008 — Populate the Properties panel from selection
- **Intent:** Display object properties in the inspector.
- **Work:**
  - Replace the Properties placeholder with a real panel.
  - When no selection exists, show a neutral placeholder (e.g., “Nothing selected”).
  - When selection exists, render a read-only view of the object’s properties (raw JSON-ish view is acceptable).
- **Done when:** Selection updates the Properties panel immediately.

## S009 — Implement textured rendering (floors + walls) with safe asset reads
- **Intent:** Provide a true textured top-down view using referenced asset textures.
- **Work:**
  - Add a minimal “read asset file bytes” IPC (relative-to-assets only; reject outside paths) to load images for textures.
  - In renderer, implement a bounded texture cache (evict on map close / cap entries).
  - Implement a resolver for world-geometry textures:
    - `floor_tex`/`wall.tex` filename → `Images/Textures/<filename>` relative to the configured assets dir.
  - Render floors using pattern fills per sector `floor_tex`.
  - Render walls using the wall `tex` (implementation may represent walls as thin polygons to allow pattern fills).
- **Done when:** Switching to Textured mode shows visible textures derived from map references and does not leak resources across repeated opens.

## S010 — Ensure validation failure messaging matches requirements
- **Intent:** Meet the exact UX requirement for validation errors.
- **Work:**
  - Confirm error dialog title/message include the exact text `Map validation failed`.
  - Ensure the “pretty printed” validator output is passed as dialog detail.
- **Done when:** Invalid maps show the specified dialog and do not load.

## S011 — Update subsystem docs (L09)
- **Intent:** Keep docs as source-of-truth for the new viewer behavior and APIs.
- **Work:**
  - Update:
    - `docs/renderer-ui-system.md` (map render modes, selection, properties)
    - `docs/menu-system.md` (View menu items)
    - `docs/app-store-system.md` (render mode state and push signal)
    - `docs/ipc-system.md` (new event channel and any new IPC)
    - `docs/assets-system.md` (asset-read API, safety constraints)
    - `docs/maps-system.md` (how mapDocument is consumed for rendering)
- **Done when:** Docs reflect the implementation and include key invariants.

## S012 — Tests and quality gates
- **Intent:** Keep code safe, testable, and compliant with laws.
- **Work:**
  - Add/extend unit tests for new/changed public methods (store setters, menu template, IPC wiring, asset read service/validator parsing paths).
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All quality gates pass.

## S013 — Initialize view origin and frame the map on open
- **Intent:** Ensure maps never appear “missing” due to off-screen placement and ensure the initial world-space origin is deterministic.
- **Work:**
  - On map open (and only when the opened map changes), initialize the Map Editor view transform so:
    - the **viewport center corresponds to world-space (0,0)**
    - the map’s content is visible immediately without manual panning
  - Define a render-only “map origin” offset derived from the decoded map bounds (and any other relevant authored points, if needed) so the map is centered around world (0,0) for rendering/hit-testing.
  - Ensure this origin offset does not mutate `MapDocument.json` and does not change Properties’ displayed authored values.
  - Define reset behavior precisely:
    - When the user pans/zooms, do not fight the user.
    - When a new map is opened, re-apply the initial framing.
- **Done when:** Opening any valid map shows visible content immediately and the view is centered deterministically.

## S014 — Retune default scale, zoom bounds, and grid scale
- **Intent:** Make maps usable at default zoom and ensure zoom bounds support both overview and close inspection.
- **Work:**
  - Define explicit view-transform defaults and bounds (initial scale, min zoom, max zoom) that do not make even the largest current map “tiny”.
  - Retune the editor grid so it reads as an orientation aid rather than overwhelming the map. This may be done by:
    - adjusting grid spacing in world units, and/or
    - making grid spacing adapt to zoom so line density stays reasonable.
  - Ensure the new defaults do not regress pan/zoom performance.
- **Done when:** At default zoom, maps are readable; at max zoom, close inspection is possible; the grid no longer dominates.

## S015 — Make object markers zoom-invariant in screen space
- **Intent:** Prevent entity/emitter/door markers from obscuring the map at high zoom.
- **Work:**
  - Change marker rendering so marker size is defined in **screen pixels** and remains approximately constant across zoom.
    - Implement by expressing marker sizes in world units as `screenPixels / view.scale` (or equivalent Konva technique).
  - Align Select-mode hit-testing thresholds with the rendered marker sizes so selection remains intuitive.
  - Confirm light *radius* visualization remains world-space (radius must still represent authored radius).
- **Done when:** At high zoom, markers remain readable without covering large sections of geometry.

## S016 — Update subsystem docs (L09) for framing/scale behavior
- **Intent:** Keep docs current with the refined viewer UX rules.
- **Work:**
  - Update `docs/renderer-ui-system.md` to document:
    - initial framing behavior on map open
    - world-origin semantics in the viewport
    - grid scale approach
    - zoom-invariant marker sizing
- **Done when:** Docs accurately describe the implemented behavior.

## S017 — Re-run quality gates after UX refinements
- **Intent:** Ensure the refinements don’t regress tests/lint/typecheck.
- **Work:**
  - Add/update unit tests for any new/changed public methods introduced by these refinements.
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All quality gates pass.
