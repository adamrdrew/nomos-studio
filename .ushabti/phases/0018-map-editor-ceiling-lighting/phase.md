# Phase 0018 — Map Editor Ceiling Textures, Sky, Lighting, and Zoom

## Intent
Improve the Map Editor’s **textured** viewport so authors can preview more of the runtime look and author maps faster:

- Allow toggling sector rendering between **floor textures** and **ceiling textures**.
- Support the special ceiling texture keyword **`SKY`** by rendering the map’s sky texture in ceiling mode.
- Increase max zoom so authors can inspect details more closely.
- Visually represent **sector base light** by darkening sector texture fills.
- Ensure sector lighting can be edited in the Properties inspector (and behaves as a 0..1 scalar).

This Phase exists now because the editor already supports textured rendering, view toggles, and sector property editing; these additions extend the same snapshot-driven state and renderer pipeline.

## Scope

### In scope

#### A) New View toggle: sector texture surface (floor vs ceiling)
- Add a main-owned, snapshot-propagated view setting to choose which sector surface the textured view displays:
  - `mapSectorSurface: 'floor' | 'ceiling'` (default `'floor'`).
- Add a View menu control that flips between floor/ceiling display.
  - The toggle affects **textured mode** sector fills only.
  - Walls, markers, and wireframe mode behavior remain unchanged.

#### B) SKY ceiling semantics in the editor
- Extend the renderer’s decoded map model to read an optional map-level `sky` filename.
- In **ceiling** surface mode:
  - If `sector.ceil_tex` is exactly `SKY` (case-insensitive), render the map’s `sky` texture as the sector fill.
  - If `sector.ceil_tex` is `SKY` but `map.sky` is missing/empty/unloadable, fall back to a safe non-crashing render (e.g., no texture fill or a neutral placeholder).
  - **Brightness rule:** SKY is rendered at **maximum brightness** (it is **not** darkened by `sector.light`).

#### C) Sector base lighting visualization
- In textured sector fills (both floor and ceiling surface modes), apply a darkening overlay derived from `sector.light`:
  - Treat `sector.light` as a scalar in the range `[0, 1]`.
  - Render multiplier: $\text{brightness} = \mathrm{clamp}(\text{light}, 0, 1)$.
  - Visual implementation constraint: use a black overlay (opacity $1 - \text{brightness}$) rather than introducing GPU filters.
  - **Exception:** ceiling SKY fills ignore `sector.light` and render at full brightness.

#### D) Increased max zoom-in
- Increase the Map Editor’s max view scale (currently clamped by `MAX_VIEW_SCALE` in `MapEditorCanvas`) to allow further zoom-in.
- Ensure the clamp applies consistently to mouse-wheel zoom and toolbar Zoom In/Out.

#### E) Sector lighting editing confirmation / normalization
- Confirm the Properties editor supports editing sector `light`.
- Ensure the UI communicates and enforces the intended domain:
  - If the engine semantics require `[0, 1]`, clamp on commit (or otherwise make the 0..1 expectation explicit in the UI).

### Out of scope
- Map file format changes (beyond reading existing `sky`/`ceil_tex`/`light` fields).
- New IPC/preload surface area.
- New validation rules or changes to the external validator contract.
- Any changes to 3D/runtime rendering; this is editor visualization only.
- Advanced lighting features (light colors, per-emitter lighting previews, shadowing).

## Constraints
- **L01 (Cross-platform parity):** No OS-specific rendering or menu behavior.
- **L02 (Offline):** No network dependencies; texture loading stays local via existing asset reads.
- **L03 (Electron security):** Keep changes renderer-local or snapshot-driven; do not widen preload/IPC.
- **L04 (Testing):** Any new/changed public method must have unit tests covering conditional paths.
- **L08 (Testability):** Keep logic for selecting sector surface/sky substitution and light->overlay mapping testable (small helpers where appropriate).
- **L09 (Docs):** Update relevant docs under `docs/` when View toggles or textured rendering rules change.

## Assumptions (explicit)
- The map JSON already includes:
  - `sectors[].ceil_tex` (string)
  - `sectors[].light` (number)
  - Optional `sky` (string) at the root level, representing a filename under `Assets/Images/Sky/`.
- In the editor, the `SKY` keyword is treated case-insensitively to match engine semantics.
- Sector lighting visualization is a usability aid; it does not need to exactly match runtime lighting.

## Acceptance criteria

### Sector surface toggle
- A View menu toggle exists to switch sector surface rendering between floor and ceiling.
- In textured mode:
  - In floor mode, sector fills use `floor_tex`.
  - In ceiling mode, sector fills use `ceil_tex` (except `SKY` handling below).
- In wireframe mode, sector fill behavior is unchanged.

### SKY rendering
- When sector surface mode is **ceiling** and a sector has `ceil_tex` set to `SKY` (any case):
  - If the map defines a non-empty `sky` filename and it is loadable, the sector fill uses the sky texture.
  - If the sky filename is missing/empty/unloadable, the editor does not crash; the sector fill degrades gracefully.
  - SKY fills render at full brightness (they are not darkened by sector base light).

### Lighting visualization
- In textured mode sector fills, `sector.light` influences darkness:
  - `light <= 0` renders the sector texture effectively black.
  - `light >= 1` renders at normal brightness.
  - Intermediate values darken proportionally.
- Lighting visualization applies to both floor and ceiling surface mode.
  - Lighting visualization does not darken ceiling SKY fills.

### Zoom
- The maximum zoom-in is increased beyond the current cap (`MAX_VIEW_SCALE` is increased).
- Mouse wheel zoom and toolbar Zoom In/Out both respect the new maximum.

### Properties editor
- Sector `light` is editable in the Properties inspector.
- The UI clearly indicates the expected range `[0, 1]` and does not allow invalid values to silently produce surprising results (via clamping-on-commit or explicit validation messaging).

### Quality gates
- Unit tests are added/updated for any new main-process public store APIs and any menu template changes.
- Existing `npm test`, `npm run typecheck`, and `npm run lint` pass.
- Docs are updated so `docs/renderer-ui-system.md` and `docs/menu-system.md` remain truthful.

## Risks / notes
- Texture caching is bounded (existing 64-entry cache). Loading additional textures (ceil/sky) must not introduce unbounded growth (L05).
- The editor’s asset path conventions differ from engine docs; sky textures must be loaded via the same safe asset-read mechanism and correct relative path.
- Some maps may use unusual ceiling values (e.g., `SKY` without `sky`); the editor must handle these gracefully.
