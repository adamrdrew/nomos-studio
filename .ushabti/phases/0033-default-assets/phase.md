# Phase 0033 — Default assets

## Intent
Allow users to configure project-wide **default assets** (sky texture, soundfont, background MIDI, and default sector textures) in the Settings window, and ensure those defaults are applied automatically when:
- creating a **new map** (map-level defaults: `sky`, `soundfont`, `bgmusic`), and
- creating **new sectors** (sector-level defaults: `floor_tex`, `ceil_tex`, and wall `tex` used during sector/room creation).

This Phase exists now because the editor already exposes per-map and per-sector asset selection, but new content creation currently derives texture defaults heuristically from the asset index (first textures) rather than respecting user preferences.

## Scope

### In scope
- **Settings model + persistence (shared + main)**
  - Extend `EditorSettings` with fields for default assets:
    - `defaultSky` (basename under `Images/Sky/`)
    - `defaultSoundfont` (basename under `Sounds/SoundFonts/`)
    - `defaultBgmusic` (basename under `Sounds/MIDI/`)
    - `defaultWallTex`, `defaultFloorTex`, `defaultCeilTex` (basenames under `Images/Textures/`)
  - Persist new fields in the settings JSON file (additive schema change, version remains `1`).
  - Preserve unknown keys (existing invariant).

- **Settings window UI (renderer, settings mode)**
  - Add dropdown controls for the new default asset fields.
  - Dropdowns are **disabled** until:
    - `settings.assetsDirPath` is set (non-null, non-whitespace), and
    - `assetIndex` is available in the snapshot (i.e., assets have been indexed successfully).
  - The Settings window MUST NOT require closing/reopening to access these dropdowns after configuring an assets directory.
    - If assets are configured but indexing is not yet complete (`assetIndex === null`), show a spinner and an **Indexing assets…** label.
    - The Settings window should trigger (or re-trigger) indexing as needed (via the existing typed preload/IPC asset refresh entrypoint).
  - Dropdown option sources (from `assetIndex.entries`, using basenames):
    - Sky texture: filter `Images/Sky/`
    - Sound font: filter `Sounds/SoundFonts/`
    - Background MIDI: filter `Sounds/MIDI/`
    - Floor/Ceiling/Wall textures: filter `Images/Textures/` (and existing fallback prefix, if used elsewhere).
  - Each dropdown supports clearing to “None” (stores `null`).

- **Default application to new content**
  - **New map creation:** When creating a new map document, initialize the map JSON root with `sky`, `soundfont`, and `bgmusic` if the corresponding defaults are set.
  - **New sector creation:** When the editor creates new sectors via the room tool (`map-edit/create-room`), use default wall/floor/ceiling textures from settings when set; otherwise fall back to the current heuristic.

- **Tests and docs (L04/L09)**
  - Update/add unit tests for all changed public APIs and new conditional paths.
  - Update settings/docs to reflect new known keys and their semantics.

### Out of scope
- Changing the asset indexer or adding richer asset metadata.
- Changing per-map/per-sector property editors (other than any refactor needed to share dropdown helpers).
- Automatically migrating or rewriting existing map files to match defaults.
- Introducing project/workspace concepts beyond app-level settings.

## Constraints
- Preserve cross-platform behavior (L01) and offline local operation (L02).
- Preserve Electron security boundary (L03): renderer must not read the filesystem directly; it must use the existing preload/IPC snapshot (`assetIndex`).
- Any new/changed public methods must have unit tests covering conditional paths (L04).
- Keep side effects behind injectable seams where applicable (L08).
- Update subsystem documentation under `docs/` for any changed behavior/data shapes (L09).
- Follow boundaries and naming guidance in `.ushabti/style.md`.

## Acceptance criteria
- Settings window shows new “Default assets” controls:
  - Sky texture (dropdown)
  - Sound font (dropdown)
  - Background MIDI (dropdown)
  - Default wall texture (dropdown)
  - Default floor texture (dropdown)
  - Default ceiling texture (dropdown)
- When `assetsDirPath` is missing or `assetIndex` is null, the above controls are disabled and include clear helper text indicating assets must be configured and indexed.
- When `assetsDirPath` has been set/changed in the Settings window and saved/applied, the Settings window shows a spinner and **Indexing assets…** label until `assetIndex` becomes available, and then enables the dropdowns **without requiring the user to close and reopen Settings**.
- Dropdowns are populated from the correct asset subfolders (by prefix) and store **basenames**.
- Saving settings persists the defaults; reopening the Settings window shows the persisted selections.
- Creating a new map sets map root fields using defaults when present:
  - `sky = <defaultSky>`
  - `soundfont = <defaultSoundfont>`
  - `bgmusic = <defaultBgmusic>`
- Creating a new room/sector uses default sector textures when present:
  - new sector `floor_tex = <defaultFloorTex>`
  - new sector `ceil_tex = <defaultCeilTex>`
  - created walls use `tex = <defaultWallTex>`
- If any required default texture is unset, empty, or not present in the available texture options, room creation falls back to the existing “first textures in `Images/Textures/`” heuristic (and still blocks if fewer than 3 usable textures exist).
- Jest/typecheck/lint are green.

## Risks / notes
- **Settings-window indexing timing:** The settings UI reads `assetIndex` from the main snapshot. If indexing is still in-flight, controls remain disabled until the snapshot contains an index.
- **Data-shape consistency:** Defaults are stored as basenames to match current map/sector fields (`sky`, `bgmusic`, `soundfont`, `floor_tex`, `ceil_tex`, wall `tex`).
- **Sector creation paths:** The current “new sector” path is the room tool (`map-edit/create-room`). If additional sector-creation commands exist or are introduced, they should adopt the same defaults policy.

