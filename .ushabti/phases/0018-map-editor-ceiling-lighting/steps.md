# Phase 0018 Steps — Map Editor Ceiling Textures, Sky, Lighting, and Zoom

## S001 — Inspect current textured sector rendering + zoom constraints
- **Intent:** Anchor the work to the existing Map Editor pipeline and avoid regressions.
- **Work:**
  - Identify the current textured sector fill path in `MapEditorCanvas` (where `sector.floorTex` is used).
  - Confirm current zoom clamps (`MIN_VIEW_SCALE`, `MAX_VIEW_SCALE`) and where zoom is applied (wheel + toolbar API).
  - Identify where View menu state is sourced (main `AppStore` → snapshot → renderer store).
- **Done when:** Notes exist describing the exact codepaths to modify and current constants (including the current `MAX_VIEW_SCALE`).

## S002 — Define the new view setting: sector surface mode
- **Intent:** Make the floor/ceiling toggle a first-class, typed, snapshot-driven setting.
- **Work:**
  - Add a shared model type: `MapSectorSurface = 'floor' | 'ceiling'`.
  - Extend main state snapshot to include `mapSectorSurface`.
  - Add main `AppStore` default and a public setter/toggle method.
- **Done when:** Main state has a deterministic default and a public API for updating the new flag.

## S003 — Unit tests for main store and snapshot wiring (L04)
- **Intent:** Keep main state changes covered and branch-complete.
- **Work:**
  - Add/update `AppStore` tests to cover:
    - default `mapSectorSurface` value
    - setter/toggle behavior and subscriber notification
  - Update snapshot tests (if present) or any IPC snapshot construction tests to cover the new field.
- **Done when:** Tests cover all conditional paths for the new public store API.

## S004 — Add View menu control for floor/ceiling surface
- **Intent:** Provide a user-facing way to switch sector surface rendering.
- **Work:**
  - Extend `createApplicationMenuTemplate` options and template to include a View menu item:
    - Either a single checkbox (e.g., “Render Ceiling Textures”) or a radio pair (“Floor”, “Ceiling”), consistent with existing menu style.
  - Wire callbacks in main (menu click → `AppStore` update).
  - Update menu template unit tests to verify presence + checked state + click wiring.
- **Done when:** View menu item(s) exist with correct checked-state behavior and tests pass.

## S005 — Thread the new flag through renderer store
- **Intent:** Keep the renderer snapshot-driven and consistent with the View menu.
- **Work:**
  - Update `AppStateSnapshot` and renderer `useNomosStore` to carry `mapSectorSurface`.
  - Ensure the renderer refresh/store update paths populate it correctly.
- **Done when:** Renderer store exposes the flag and it updates live via `state:changed`.

## S006 — Extend the decoded map view model with optional `sky`
- **Intent:** Enable SKY ceiling rendering without changing the persisted `MapDocument.json` typing contract.
- **Work:**
  - Update the renderer’s `MapViewModel` to include `sky: string | null`.
  - Update `decodeMapViewModel` to parse root `sky` as an optional trimmed string.
  - Add unit tests in `mapDecoder.test.ts` for:
    - `sky` absent → `null`
    - `sky` empty string → `null`
    - `sky` set → value is captured
- **Done when:** Decoder tests pass and the renderer has access to the sky filename.

## S007 — Update texture loading to support ceiling + sky assets (bounded)
- **Intent:** Ensure required textures are available when toggling surface mode while keeping caching bounded (L05).
- **Work:**
  - Expand the “needed texture filenames” set to include:
    - ceiling textures when relevant
    - sky texture when any ceiling uses `SKY` and the map defines `sky`
  - Ensure sky textures are loaded from the correct relative asset path: `Images/Sky/<fileName>` (separate from `Images/Textures/`).
  - Keep the cache bounded and revoke object URLs on eviction/unmount as today.
- **Done when:** Switching surface mode does not crash; textures load (or gracefully fall back) without unbounded cache growth.

## S008 — Implement sector surface selection + SKY substitution in rendering
- **Intent:** Make the textured view display the chosen surface correctly.
- **Work:**
  - In textured sector fills, select the source texture based on `mapSectorSurface`:
    - floor mode → `sector.floorTex`
    - ceiling mode → `sector.ceilTex`, except:
      - if `sector.ceilTex` equals `SKY` case-insensitively, use `decodedMap.sky`.
  - Define a graceful fallback when the chosen image is missing/loading:
    - keep current behavior (don’t fill until image is available) or a neutral placeholder.
- **Done when:** Toggling the View setting visibly switches the sector fill surface; SKY sectors show sky when available.

## S009 — Implement sector base lighting overlay in textured fills
- **Intent:** Preview authored ambient lighting directly in the map view.
- **Work:**
  - Apply a black overlay over the sector fill with opacity `1 - clamp01(sector.light)`.
  - Ensure overlay works for both surface modes.
  - Ensure ceiling SKY-derived fills render at full brightness (no darkening overlay).
  - Ensure overlay does not affect hit-testing.
- **Done when:** Sectors darken/brighten according to `light` without introducing rendering artifacts.

## S010 — Increase max zoom-in and confirm tooling consistency
- **Intent:** Allow closer inspection without breaking pan/zoom ergonomics.
- **Work:**
  - Increase `MAX_VIEW_SCALE` to a higher value (target: 64 unless inspection suggests a better bound).
  - Confirm both wheel zoom and toolbar Zoom In/Out can reach the new max and clamp correctly.
- **Done when:** Zoom-in visibly goes beyond the previous limit and remains stable.

## S011 — Properties editor: ensure sector light is constrained and communicative
- **Intent:** Make sector lighting authoring predictable and aligned with visualization.
- **Work:**
  - Confirm the Sector Properties editor edits `light`.
  - Add explicit range semantics:
    - clamp to `[0, 1]` on commit, or show a validation message when out of range and revert.
  - Optionally add a slider control (0..1) if consistent with current inspector UX.
- **Done when:** Users can author sector light reliably as a 0..1 scalar.

## S012 — Update docs (L09)
- **Intent:** Keep subsystem documentation truthful.
- **Work:**
  - Update `docs/menu-system.md` to include the new View toggle.
  - Update `docs/renderer-ui-system.md` to document:
    - sector surface mode (floor vs ceiling)
    - SKY ceiling substitution behavior
    - sector light overlay behavior
    - updated zoom bounds if documented there.
- **Done when:** Docs match the new behavior and options.

## S013 — Quality gates + manual verification
- **Intent:** Ensure the Phase ships green and behaves correctly.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual checks:
    - Toggle floor/ceiling mode in textured view.
    - Verify SKY ceilings render the map’s sky texture when available.
    - Verify light=0/0.5/1 visual output.
    - Verify max zoom-in is increased.
- **Done when:** All commands pass and manual checks are recorded in the PR description.
