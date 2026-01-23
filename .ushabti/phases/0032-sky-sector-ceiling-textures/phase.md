# Phase 0032 — SKY support for sector ceiling textures

## Intent
Enable authoring a sector ceiling “skybox” via the engine’s magic `ceil_tex = "SKY"` value, without adding a synthetic "SKY" entry into the existing ceiling texture dropdown.

This Phase exists now because the engine already supports `ceil_tex: "SKY"`, but the editor currently only supports selecting ceiling textures from `Assets/Images/Textures/` and has no dedicated UI affordance for sky ceilings.

## Scope

### In scope
- **Inspector UI (Object Properties → Sector)**
  - Add a new **Show Skybox** on/off control implemented as a radio choice (two options is acceptable):
    - Off (default)
    - On
  - When **Show Skybox = On**:
    - Commit `ceil_tex` to the literal string `"SKY"` (uppercase).
    - Hide the existing ceiling-texture dropdown for `ceil_tex`.
  - When **Show Skybox = Off**:
    - Show the existing ceiling-texture dropdown for selecting a file from `Images/Textures/`.
    - Ensure the dropdown never needs to contain a "SKY" option.

- **State derivation**
  - The control’s current state MUST be derived from the selected sector’s `ceil_tex` value:
    - Case-insensitive: `ceil_tex` equal to `SKY` (ignoring surrounding whitespace and case) means **Show Skybox = On**.

- **Edit path validation**
  - Confirm main-process edit application accepts setting `ceil_tex` to `"SKY"` via the existing `map-edit/update-fields` command.
  - Add/adjust unit tests for the relevant public edit APIs if required (L04).

- **Documentation updates (L09)**
  - Update renderer UI documentation to describe the new Sector Object Properties behavior.

- **Textured rendering (ceiling surface) SKY resolution**
  - In textured render mode, when the sector surface view is set to **ceiling** and a sector’s `ceil_tex` is `SKY` (case-insensitive), resolve the rendered texture via the map root’s `sky` property:
    - `map.sky = "red.png"` resolves to `Assets/Images/Sky/red.png` (relative path `Images/Sky/red.png`).
  - If `map.sky` is missing/empty/unloadable, rendering must fail gracefully (skip the ceiling fill for SKY sectors; no crash).

### Out of scope
- Implementing or changing skybox rendering. (Renderer textured ceiling rendering already treats `ceil_tex SKY` as a sky ceiling per docs; this Phase is editor authoring/UI only.)
- Adding a `SKY` entry to any texture dropdown (explicitly forbidden for this Phase).
- Changing the asset indexing rules or adding new texture locations.
- Adding new IPC or preload APIs.

## Constraints
- Must preserve cross-platform behavior (L01) and offline capability (L02).
- Must preserve Electron security boundaries (L03): renderer edits must remain via `window.nomos.map.edit(...)`.
- Any changed/added public methods must have unit tests covering all conditional paths (L04).
- Keep changes testable and dependency-injectable where side effects exist (L08).
- Update subsystem docs that change (L09), at minimum `docs/renderer-ui-system.md`.
- Follow the project structure guidance in `.ushabti/style.md` (UI logic stays in renderer; map edits stay in main services/command engine).

## Acceptance criteria
- With a **sector selected**, the Inspector’s Object Properties sector editor shows a **Show Skybox** control.
- If the sector’s `ceil_tex` is `SKY` (case-insensitive), **Show Skybox** is shown as **On** and the ceiling texture dropdown is hidden.
- Toggling **Show Skybox** to **On** commits a single update that sets `ceil_tex` to `"SKY"`.
- Toggling **Show Skybox** to **Off** reveals the ceiling texture dropdown.
- The ceiling texture dropdown options remain sourced only from indexed textures; no synthetic `SKY` option is introduced.
- If **Show Skybox** is turned **Off** while the current persisted `ceil_tex` is `SKY`, the editor MUST ensure the dropdown is in a valid state without introducing `SKY` as an option.
  - Requirement: on Off-toggle, if the persisted value is SKY, immediately commit `ceil_tex` to the **first** available ceiling texture option from the dropdown (i.e., the first indexed entry under `Images/Textures/`, using the same ordering rules the dropdown uses).
  - If no textures are indexed under `Images/Textures/`, turning Show Skybox Off MUST be disabled (or otherwise blocked) with clear inline feedback explaining that at least one texture is required.
  - In **textured** render mode with sector surface set to **ceiling**, SKY ceilings render using the resolved sky texture:
    - If `sector.ceil_tex` is SKY (case-insensitive) and `map.sky` is set (non-empty), the renderer loads `Images/Sky/<map.sky>` and uses it as the sector ceiling fill.
    - If `map.sky` is missing/empty/unloadable, the renderer skips SKY ceiling fills (no crash).
- Unit tests demonstrate that `map-edit/update-fields` can set a sector’s `ceil_tex` to `"SKY"` and persist it in `MapDocument.json` (as applicable based on current validation rules).
- `npm test -- --runInBand`, `npm run lint`, and `npm run typecheck` are green.
- Documentation is updated to match the new UI behavior.

## Risks / notes
- **Toggle-off behavior:** This Phase intentionally does not attempt to remember/restore a prior non-SKY texture; instead it deterministically selects the first available texture option to keep the map valid.
- **No-textures edge case:** If no textures are indexed, the UI must block switching SKY off to avoid committing an invalid `ceil_tex` value.
- **Rendering dependency:** SKY ceiling rendering depends on `map.sky`; ensure the behavior is case-insensitive on `ceil_tex` and is resilient to missing/unloadable sky assets.
- Ensure the UI does not get into a broken state where an HTML `<select>` has a value not present in options; this is the primary reason we must not keep `SKY` in the dropdown.
