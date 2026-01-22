# Phase 0024 — Wall Toggles + Sector Floor Toggle Position

## Intent
Expose additional **wall** and **sector** properties in the Inspector’s **Object Properties** panel to support interactive map features:

- **Wall toggles**: a wall can act as a switch that toggles a target sector.
- **Sector floor toggled position**: author a toggled floor Z position for any sector.

Also add a View overlay to **highlight toggle walls** (green), mirroring existing portal highlighting behavior.

This Phase exists now because the underlying map format already contains these fields (or is expected to), and authors need first-class GUI editing rather than hand-editing JSON.

## Scope

### In scope

#### A) Wall toggle fields in Object Properties
For selected **walls**, add editing support for the following JSON fields:
- `toggle_sector: boolean`
  - Render as a checkbox.
  - This control is always visible for walls.
- When `toggle_sector === true`, additionally show:
  - `toggle_sector_id: number`
    - Render as a dropdown of valid sector IDs from the currently open map.
    - Include an **eye-dropper** button next to the dropdown:
      - When active, the editor enters a “pick sector” mode.
      - The next sector selection in the Map Editor sets `toggle_sector_id` to that sector’s ID and exits pick mode.
      - Pick mode must not widen privileged APIs (renderer-local UI state only).
  - `toggle_sector_oneshot: boolean`
    - Render as a checkbox.
  - `toggle_sound: string` and `toggle_sound_finish: string`
    - Render as dropdowns sourced from Assets under `Sounds/Effects/`.
    - Store the **basename** (e.g., `Flashlight On.wav`) unless map samples indicate the engine expects a relative path.

Default behavior: if `toggle_sector` is false/unset, only the `toggle_sector` checkbox is shown.

#### B) Sector floor toggled position field
For selected **sectors**, add editing support for:
- `floor_z_toggled_pos: number`
  - Render as an integer dropdown from **-10 to 10** (inclusive).
  - This control is always visible for sectors (no conditional show/hide).

#### C) View overlay: Highlight Toggle Walls
Add a new View menu checkbox:
- **Highlight Toggle Walls**

When enabled, any wall with `toggle_sector === true` is shaded/overlaid in **green**, using the same visual treatment style and layering approach as portal highlighting (blue) today.

### Out of scope
- Implementing runtime gameplay behavior (triggering sector motion, playing sounds, one-shot enforcement). This Phase only edits and visualizes map data.
- Adding new asset indexing metadata or filesystem queries from the renderer.
- Sound preview/playback in the editor.
- Automatically wiring walls↔sectors; authors explicitly set `toggle_sector_id`.

## Constraints
- **L01 (Cross-platform parity):** Asset filtering must use POSIX-normalized `AssetIndex.entries` prefixes (no OS-specific path logic).
- **L02 (Offline):** All functionality must work offline using the existing assets index snapshot.
- **L03 (Electron security):** Renderer must not access filesystem/Node APIs; use only snapshot state + existing preload methods.
- **L04 (Testing):** Any changed/added public methods (AppStore, menu template, shared IPC/state models) must have unit tests covering new conditional paths.
- **L08 (Design for testability):** New selection/pick-mode logic should be renderer-local, deterministic, and not coupled to Konva event internals beyond existing selection plumbing.
- **L09 (Docs):** Update subsystem docs under `docs/` that describe the Object Properties editor and View menu overlays.

## Assumptions (explicit)
- Map sector objects have stable numeric `id` fields suitable for dropdown selection.
- Wall toggle fields are stored on wall objects with the names shown in the example:
  - `toggle_sector`, `toggle_sector_id`, `toggle_sector_oneshot`, `toggle_sound`, `toggle_sound_finish`.
- The sector field name is **`floor_z_toggled_pos`** (per the provided JSON example).
- Sound dropdown options come from assets under `Assets/Sounds/Effects/`, which appear in `AssetIndex.entries` with the relative prefix `Sounds/Effects/`.

## Acceptance criteria

### Wall toggle editing UI
- Selecting a wall shows a `toggle_sector` checkbox in Object Properties.
- When `toggle_sector` is unchecked:
  - no additional toggle-related controls are shown.
- When `toggle_sector` is checked:
  - `toggle_sector_id` dropdown is shown and lists valid sector IDs.
  - Eye-dropper mode can be enabled; selecting a sector sets `toggle_sector_id` to that sector’s ID and exits eye-dropper mode.
  - `toggle_sector_oneshot` checkbox is shown.
  - `toggle_sound` and `toggle_sound_finish` dropdowns are shown and populated from `Sounds/Effects/` assets.
- All edits commit via the existing `map-edit/update-fields` command path and are undoable/redoable.

### Sector toggled floor position UI
- Selecting a sector shows `floor_z_toggled_pos` as a dropdown with integer values -10..10.
- Changing the value commits an edit that persists on save and is undoable/redoable.

### Highlight Toggle Walls overlay
- View → Highlight Toggle Walls exists and is off by default.
- When enabled, walls with `toggle_sector === true` are overlaid in green in the Map Editor.
- When disabled, rendering matches pre-Phase behavior.
- Overlay must not change hit-testing/selection behavior.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Menu/template and AppStore state changes are covered by unit tests.
- `docs/renderer-ui-system.md` and `docs/menu-system.md` reflect the new View toggle and property editor capabilities.

## Risks / notes
- **Field name drift:** sector toggled Z field name appears in two variants in the request; confirm by inspecting existing map samples and/or validator expectations.
- **Asset folder naming drift:** confirm actual sounds folder prefix (`Sounds/Effects/` vs `Sounds/Effects` vs `Sounds/SFX/`). Prefer matching `AssetIndex.entries` prefixes.
- **UX safety:** Eye-dropper mode must be visibly active and must exit reliably after setting the ID (or on Escape) to avoid confusing selection behavior.
