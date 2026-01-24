# Steps — Phase 0033 Default assets

## S001 — Inventory current asset dropdown sources and naming
- **Intent:** Align defaults with existing map/sector asset semantics.
- **Work:**
  - Confirm how map-level fields are stored (`sky`, `bgmusic`, `soundfont`) and that they are basenames.
  - Confirm how sector/wall textures are stored (`floor_tex`, `ceil_tex`, wall `tex`) and that they are basenames.
  - Identify existing helper(s) for extracting basenames from `assetIndex.entries` so Settings UI can reuse them.
- **Done when:** Plan notes include exact prefixes and existing helper locations.

## S002 — Extend shared settings model (`EditorSettings`) for default assets
- **Intent:** Make defaults first-class, typed, and available to both main and renderer.
- **Work:**
  - Add new fields to `EditorSettings`:
    - `defaultSky`, `defaultSoundfont`, `defaultBgmusic`
    - `defaultWallTex`, `defaultFloorTex`, `defaultCeilTex`
  - Ensure all fields are `string | null`.
- **Done when:** Type changes compile across shared/main/preload/renderer.

## S003 — Persist new settings fields (codec + repo) and update format docs
- **Intent:** Ensure defaults survive app restarts and remain forward-compatible.
- **Work:**
  - Update `settingsCodec` decode/encode to include new known keys.
  - Update unknown-key preservation to exclude the newly known keys.
  - Update `src/main/infrastructure/settings/settingsFileFormat.md` to document the new keys (version remains 1).
  - Update `docs/settings-system.md` to describe the new settings and semantics.
- **Done when:** Settings round-trip with new keys; docs reflect the updated known schema.

## S004 — Update SettingsService tests for merge semantics (L04)
- **Intent:** Prevent regressions in `Partial<EditorSettings>` updates and clearing behavior.
- **Work:**
  - Add/adjust tests to ensure:
    - `undefined` fields do not overwrite existing defaults.
    - `null` clears a default.
    - updating one default leaves others unchanged.
- **Done when:** Tests cover all branch paths introduced by new settings fields.

## S005 — Add “Default assets” dropdowns to Settings window UI
- **Intent:** Provide a user-facing way to configure defaults.
- **Work:**
  - Add a new section in the Settings window UI for default assets.
  - Populate dropdown options from `assetIndex.entries` filtered by prefix:
    - `Images/Sky/` → `defaultSky`
    - `Sounds/SoundFonts/` → `defaultSoundfont`
    - `Sounds/MIDI/` → `defaultBgmusic`
    - `Images/Textures/` (+ existing fallback if applicable) → `defaultWallTex`, `defaultFloorTex`, `defaultCeilTex`
  - Disable the section until `assetsDirPath` is configured and `assetIndex` is non-null.
  - While `assetsDirPath` is configured but `assetIndex` is still null, show a spinner + **Indexing assets…** label (instead of forcing a save+reopen flow).
  - Provide “None” option for each dropdown (stores `null`).
- **Done when:** Settings window renders the dropdowns and enablement matches prerequisites.

## S006 — Save/load defaults in Settings UI
- **Intent:** Ensure the Settings UI is a faithful view of persisted settings, and that users can configure defaults in one session.
- **Work:**
  - Load existing default settings values when opening the Settings window.
  - Replace the current “Save closes the window” behavior with an **Apply** flow:
    - **Apply** saves changes via `window.nomos.settings.update(...)` but keeps the Settings window open.
    - **Done** closes the window.
  - After applying an `assetsDirPath` change, ensure assets indexing is triggered (or re-triggered) and the UI shows **Indexing assets…** until `assetIndex` is available.
  - Ensure save failures are surfaced (existing error callout pattern).
- **Done when:** Saving persists defaults and reopening shows the selected values.

## S007 — Apply map-level defaults when creating a new map
- **Intent:** New maps start with the user’s preferred sky/music configuration.
- **Work:**
  - Update the new-map creation workflow so the created map JSON root includes:
    - `sky`, `soundfont`, `bgmusic` when corresponding defaults are set.
  - Add/adjust unit tests for `CreateNewMapService.createNewMap()` to verify the produced JSON.
- **Done when:** Tests show new map JSON includes the defaults and unchanged behavior remains correct when defaults are null.

## S008 — Apply sector texture defaults during room/sector creation
- **Intent:** New sectors created by tools use user-preferred textures.
- **Work:**
  - Update the room tool defaults selection logic to:
    - Prefer `defaultWallTex/defaultFloorTex/defaultCeilTex` from settings when all are present and valid.
    - Otherwise fall back to the existing heuristic (first 3 textures under `Images/Textures/`).
  - Ensure “valid” means non-empty and present in the available texture options.
  - Add/adjust tests for the defaults-selection logic (prefer a small pure helper with deterministic unit tests).
- **Done when:** Newly created rooms use configured defaults and tests cover both default-driven and fallback paths.

## S009 — Documentation updates (L09)
- **Intent:** Keep subsystem docs accurate.
- **Work:**
  - Update `docs/settings-system.md` with new settings fields.
  - Update `docs/renderer-ui-system.md` Settings section to describe the new dropdowns and their prerequisites.
  - If room tool docs mention the heuristic defaults, update them to include “settings defaults override the heuristic when set”.
- **Done when:** Docs match implemented behavior.

## S010 — Verification pass
- **Intent:** Ensure quality gates and key workflows remain intact.
- **Work:**
  - Run `npm test -- --runInBand`, `npm run typecheck`, and `npm run lint`.
  - Manual smoke:
    - Configure assets dir, ensure index exists, open Settings and set defaults.
    - Create New Map: verify Map Properties show the default `sky/soundfont/bgmusic`.
    - Use Room tool to create a sector: verify wall/floor/ceiling textures match configured defaults.
- **Done when:** All checks are green and manual smoke matches acceptance criteria.
