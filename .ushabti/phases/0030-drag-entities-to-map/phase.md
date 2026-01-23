# Phase 0030 — Drag Entities to Map (Entity Browser)

## Intent
Add an Entities browser panel and drag-and-drop workflow so a user can place entities onto the map by dragging a manifest-defined entity onto a sector.

This Phase exists now because entity placement is currently possible only via editing JSON fields / existing placement tooling, which is slower than direct authoring and does not leverage the engine’s entity manifest as the single source of truth.

## Scope

### In scope

#### A) New right-side panel tab: Entities
- Add a new tab in the right-hand DockView group, peer to the existing Inspector panel:
  - Title: **Entities**
  - Non-closable core panel (same rule as Map Editor + Inspector).

#### B) Populate Entities list from the entity manifest
- Load the entity manifest from the configured assets directory using preload/IPC:
  - Primary path: `Entities/entities_manifest.json`
  - Fallback path: `Assets/Entities/entities_manifest.json`
- Parse the manifest’s `files[]` list (relative paths like `defs/<name>.json`).
- For each entry in the manifest list:
  - Load the entity definition JSON via `window.nomos.assets.readFileBytes`.
  - Parse required display fields:
    - `name` (string)
    - `sprite.file.name` (string)
    - `sprite.frames.dimensions.x` and `.y` (numbers) for thumbnail cropping
- Render a list row per entity:
  - Left: a thumbnail image derived from the sprite file
  - Right: the entity `name`
  - Also display `sprite.file.name` (as text or secondary label) for quick identification.

#### C) Thumbnail rendering (first frame)
- For the thumbnail, load the referenced sprite sheet image bytes via `window.nomos.assets.readFileBytes`.
- Display the first frame by clipping the rectangle:
  - origin: `(0,0)`
  - size: `(frameWidthPx, frameHeightPx)` from `sprite.frames.dimensions`
- If the sprite cannot be found/loaded/decoded, render a stable placeholder (no crash).

#### D) Drag-and-drop placement onto the map
- Make entity rows draggable.
- Enable dropping onto the Map Editor surface:
  - While dragging, the map shows a **valid/invalid** cursor state.
  - Drops are only allowed when the cursor position is inside a sector.
- On a valid drop:
  - Add a new entry to the map JSON `entities[]` array at the drop world coordinates.
  - The new entity uses the entity def `name` as the stored `def` field (engine-facing name).
  - Set `yaw_deg` to a default of `0` (unless a project standard exists).
  - Selection sets to the newly created entity (so Inspector can immediately edit it).

#### E) Asset refresh integration
- When the assets directory index is refreshed (Asset Index rebuilt), the Entities list must re-load:
  - Re-read the manifest
  - Re-read entity defs
  - Update list contents (add/remove/update) deterministically

#### F) Tests + documentation (L04/L09)
- Add unit tests for any new/changed public methods and all conditional paths.
- Update documentation to reflect the new Entities panel and new map-edit command(s).

### Out of scope
- Rendering entity sprites on the map canvas (markers can remain the existing simple shape).
- Editing entity def files or validating entity def schema beyond what’s needed for display.
- Dragging existing placed entities (already covered by Move tool).
- Entity rotation/auto-yaw during placement.
- Search/filter UI for the entity list (may be added later).
- Virtualized list performance work (unless necessary to prevent severe UI regressions).

## Constraints
- **L01 Desktop Cross-Platform Parity:** Use OS-agnostic paths and DOM drag/drop behaviors; no OS-specific file assumptions.
- **L02 Offline Local Operation:** No network dependency for manifest/defs/sprites.
- **L03 Electron Security:** Renderer must not read the filesystem directly; use `window.nomos.assets.readFileBytes` only.
- **L04 Testing Policy:** New/changed public APIs must have unit tests covering conditional paths.
- **L05 Resource Safety:** Any created `blob:` URLs must be revoked; avoid unbounded caching.
- **L08 Design for Testability:** Keep parsing and placement logic in pure functions that can be unit-tested.
- **L09 Subsystem Documentation:** Update docs in `docs/` to match behavior and API.

## Acceptance criteria
- The right-hand panel includes a new **Entities** tab that is a peer to **Inspector**.
- The Entities tab lists entities defined in the manifest (and only those):
  - Each row shows a thumbnail (first sprite frame) and the entity `name`.
  - The UI is resilient to missing/invalid files (no crash; clear placeholder/errors).
- Dragging an entity row over the map:
  - shows an invalid cursor state when not over any sector
  - prevents dropping outside any sector
- Dropping onto a sector:
  - appends a new placement to map JSON `entities[]` with correct `x/y` and `def` set to entity name
  - results in a single undoable edit (one undo step)
  - selects the newly created entity on success
- After an asset directory refresh, the Entities list updates to match the refreshed manifest/defs.
- Jest, typecheck, and lint are green.
- Docs are updated:
  - `docs/renderer-ui-system.md`
  - `docs/map-edit-command-system.md`
  - plus any additional subsystem doc that becomes inaccurate.

## Assumptions
- Map entity placements use the existing JSON shape (as decoded today):
  - `entities[]` entries include `x`, `y`, optional `yaw_deg`, and optional `def`.
- Engine expects map placements to reference entity defs by **def name** (the `name` field inside the entity def JSON), not by manifest file path.
- Sprite assets referenced by `sprite.file.name` can be resolved from the assets directory via a small set of known prefixes (to be confirmed during implementation). If multiple matches exist, the editor uses a deterministic resolution rule.

## Risks / notes
- **Sprite path ambiguity:** entity defs provide only a filename (no directory). The editor must resolve this safely and deterministically, or show a placeholder.
- **Drag/drop across canvas:** Konva’s canvas surface requires careful mapping from DOM drag events to world coordinates; correctness must be tested with pan/zoom and map origin offsets.
- **Large entity lists:** loading all sprite sheets eagerly could be expensive; prefer metadata-first and lazy thumbnail load with caching.
