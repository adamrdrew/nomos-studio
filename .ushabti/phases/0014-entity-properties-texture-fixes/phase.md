# Phase 0014 — Entity Properties + Textured Rendering Fixes

## Intent
Fix two user-facing regressions in the editor:
1) The Inspector **Properties** viewer for selected entities should correctly display and edit the entity’s current definition via the manifest-backed dropdown (and label it “Entity”).
2) The Map Editor should default to **textured** render mode and textured rendering should tile at a legible scale rather than stretching a single blurry texture across large surfaces.

This Phase exists now because both issues block basic authoring workflows: selecting enemies shows incorrect data, and textured mode is currently unusable for verifying map materials.

## Scope

### In scope

#### A) Properties: entity definition dropdown correctness
- For a selected entity (including enemies), the Properties field currently named `defName` must:
  - Load available entity defs from `Assets/Entities/entities_manifest.json` (manifest `files` list).
  - Present a dropdown listing all manifest entries.
  - Show the **current** selected entity’s definition (not always `(none)`).
  - Commit changes through the existing `map-edit/update-fields` mechanism so they persist and are undoable.

#### B) Properties: label rename
- The Properties label for the field must be **Entity** (not `defName`).

#### C) Map render mode default
- On startup / map open (per the existing state flow), the Map Editor should be in **textured** mode by default, not wireframe.

#### D) Textured rendering tiling / scale
- In textured mode, floor/wall textures should render at a legible texel density and **repeat** (tile) rather than being stretched into a single large blurry texture.

### Out of scope
- Adding new rendering modes, toggles, or UI controls beyond what is required.
- Adding mipmapping/anisotropic filtering controls or custom texture filtering settings.
- Changing asset indexing rules, adding new preload APIs, or broadening renderer filesystem access (L03).
- Redesigning the entity definition file format or introducing a new entity ID system.

## Constraints
- **L03 (Electron security):** The renderer must load the manifest via `window.nomos.assets.readFileBytes` and must not read the filesystem directly.
- **L01 (Cross-platform parity):** Asset paths must remain POSIX-style relative paths (`Entities/...`) consistent with the asset index contract.
- **L04 (Testing):** Any changed public method must have unit tests covering conditional paths.
  - Renderer store changes must be covered by existing store tests where applicable.
- **L09 (Docs):** Update relevant docs if their described behavior becomes inaccurate (at minimum `docs/renderer-ui-system.md` if the default render mode is documented/assumed).
- Style guide:
  - Keep map mutation in main via `map-edit/update-fields`.
  - Avoid new dependencies.

## Assumptions (explicit; adjust during implementation if repo reality differs)
- Entity definition choices are derived from the manifest `files` array, where each entry is a relative path like `defs/shambler.json` under `Assets/Entities/`.
- The map entity field being edited is the existing string field `defName` in the map JSON (as seen in Phase 0013 notes), and its stored value is either:
  - **Option A:** the def base name (e.g. `shambler`), or
  - **Option B:** the manifest relative path (e.g. `defs/shambler.json`).
  Implementation should match whatever the map format currently uses; the UI must display a friendly name either way.
- Texture tiling “legible scale” is achieved by using an existing world-units-per-tile constant if present; otherwise introduce a single, centralized constant (e.g., 64 world units per texture tile) and apply it consistently to floors and walls.

## Acceptance criteria

### Entity dropdown correctness
- When selecting an enemy entity, the Properties Inspector shows **Entity: <current value>** where the current value matches the selected entity’s stored definition.
- The dropdown options include every entry in `Assets/Entities/entities_manifest.json` (manifest `files`).
- Choosing a different entity definition updates the selected entity:
  - immediately reflects in the dropdown,
  - persists after Save + reopen,
  - is undoable/redoable.
- Manifest load failures (missing file / invalid JSON) fail gracefully:
  - UI shows a clear non-crashing state (e.g., empty list + inline error text),
  - other Properties fields remain usable.

### Label rename
- The Properties label reads **Entity** (not `defName`).

### Default render mode
- Opening the app and opening a map results in `mapRenderMode` being **textured** by default.
- Switching to wireframe still works as before.

### Textured tiling / scale
- In textured mode, walls/floors tile their textures (repeat) rather than stretching one texture across the full surface.
- Textures are legible at typical zoom levels (no “single huge blurry texture” effect).

### Verification
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Manual smoke recorded in Phase review:
  - entity selection shows correct current Entity
  - can change Entity via dropdown and it persists
  - default mode is textured
  - textured mode tiles textures and looks legible

## Risks / notes
- If the map format stores `defName` differently than the manifest naming, the fix must focus on consistent mapping (display vs stored value) without breaking existing maps.
- Texture tiling requires careful mapping between world units and pixel-space rendering primitives (Konva patterns); avoid introducing per-texture special cases.
