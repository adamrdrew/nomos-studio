# Phase 0037 — Texture Select Control

## Intent
Replace the current texture file-name-only dropdowns with a single reusable **Texture Select** control that provides a **visual, scrollable grid** of texture thumbnails, so users can actually see what they’re selecting.

This Phase exists now because texture selection is a frequent workflow (sector floor/ceiling, wall, door, “paint all walls”, and settings defaults), and the current UX forces users to guess based on filenames.

## Scope

### In scope

#### A) New reusable Texture Select control (renderer)
- Create a renderer UI control that:
  - Presents the current selection in a compact “closed” state.
  - Opens a dropdown/popup that displays a **scrollable grid** of textures.
  - Each grid item shows a **thumbnail preview** of the texture and (optionally) its filename.
  - Selecting a texture closes the dropdown and calls the existing `onChange` callback with the **same string value** currently used by the rest of the editor (no downstream logic changes).
  - Supports an optional “none/unset” selection for contexts that currently allow it.
  - Handles missing/unloadable texture previews gracefully (e.g., placeholder tile + filename).

Notes:
- Thumbnails must be derived from asset bytes read via the existing preload API (`window.nomos.assets.readFileBytes`) to respect **L03**.
- The control must not change any map-edit command behavior or selection/commit logic; it is a UI-only improvement.

#### B) Use the control everywhere textures are selected
Replace the existing filename dropdowns in these contexts with the new control:
- **Ceiling texture** (sector properties, when Skybox is off)
- **Floor texture** (sector properties)
- **Wall texture** (wall properties)
- **Door texture** (door properties)
- **Paint all walls in room texture** (“Texture Walls” section in sector properties)
- **Default textures in Settings** (default wall/floor/ceiling texture)

Integration must preserve all existing semantics:
- Same values stored/committed (including trimming behavior and `MAP_EDIT_UNSET` where currently used).
- Same “Set” button workflow for “Texture Walls” (dropdown/picker selection does not auto-commit; button commits).
- Same special states where applicable (e.g., “(select texture)” placeholder, “(mixed)” sentinel for sector wall textures).

#### C) Resource safety for previews (L05)
- Implement thumbnail loading in a way that avoids unbounded memory growth:
  - Revoke `blob:` object URLs when no longer needed.
  - Keep any in-memory thumbnail cache bounded (LRU or similar).
  - Avoid leaking event listeners / async work when components unmount.

#### D) Documentation update (L09)
- Update the renderer UI subsystem docs to mention the new Texture Select control and where it is used.

### Out of scope
- Any changes to map domain models, map editing commands, or persistence.
- Adding new asset index metadata (e.g., image dimensions, tags, categories) beyond what is required to show thumbnails.
- Adding search/tagging/category systems for textures (filename filtering inside the picker is optional; if added, keep it minimal).
- Changes to how textures are resolved for rendering in the canvas (MapEditorCanvas texture cache behavior remains as-is).

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** the picker must behave equivalently on macOS/Windows/Linux.
  - **L03 (Electron security):** renderer must load texture bytes only through preload/IPC (`window.nomos.assets.readFileBytes`).
  - **L05 (Resource safety):** do not leak `blob:` URLs; keep caches bounded.
  - **L09 (Docs current):** update renderer UI docs to reflect the new control.
- Must follow `.ushabti/style.md`:
  - Keep UI changes confined to renderer/UI concerns.
  - Avoid introducing new dependencies unless clearly necessary.
  - Prefer small focused modules (e.g., a `TextureSelect` component + a small thumbnail loader helper).

## Phase decisions
- **Value contract:** The picker operates on the same `string` texture basenames currently used in UI and stored in the map/settings.
- **Preview strategy:** Use `window.nomos.assets.readFileBytes` + `URL.createObjectURL(new Blob(...))` to render previews.
- **Grid UX:** A scrollable grid with consistent tile size (e.g., 64–96px), showing a selected-state outline and hover highlight.
- **Texture list source:** Continue to derive selectable texture basenames from `AssetIndex.entries` under `Images/Textures/` with fallback `Assets/Images/Textures/`, matching current behavior.

## Acceptance criteria

### Picker UX
- In all texture-selection locations listed in Scope B, the control shows a visual grid of textures (not just filenames).
- The dropdown/popup grid is scrollable and remains usable with large numbers of textures.
- Selecting a texture updates the underlying value exactly as before (same strings), and the editor behavior is unchanged aside from the improved UI.
- Missing/unloadable textures do not crash the UI; they render as a placeholder entry.

### Semantics preserved
- Door texture still supports “unset” behavior (clearing uses the existing `MAP_EDIT_UNSET` path).
- “Texture Walls” still uses the existing “pick value then press Set to commit” workflow.
- Sector Skybox toggle behavior remains unchanged (including hiding/showing the ceiling texture control).
- Settings default texture fields still allow “none” (empty value -> `null` in persisted settings) and still show “(missing)” entries when appropriate.

### Resource safety
- Texture preview URLs are revoked on unmount/eviction; no unbounded growth in a typical session while opening/closing pickers.

### Docs and quality gates
- Renderer UI docs updated to describe the Texture Select control.
- `npm run lint`, `npm run typecheck`, and `npm test` all pass.

## Risks / notes
- **Large texture sets:** Rendering hundreds of thumbnails can be expensive; prefer basic virtualization-lite (bounded cache + scroll container) and avoid preloading every thumbnail eagerly.
- **MIME type detection:** Texture formats may vary; use a conservative extension-based MIME guess (as done elsewhere) and fail gracefully.
- **Jest environment:** Current Jest config runs in `node`, so automated UI interaction tests are not expected in this Phase; rely on manual verification plus unit tests for any new pure helpers.
