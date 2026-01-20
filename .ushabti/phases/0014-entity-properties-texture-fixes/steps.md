# Phase 0014 Steps — Entity Properties + Textured Rendering Fixes

## S001 — Confirm current behavior + locate the responsible code paths
- **Intent:** Ensure we fix root causes, not symptoms.
- **Work:**
  - Reproduce the entity Properties issue: select an enemy and observe the `defName` field showing `(none)`.
  - Locate the entity Properties editor implementation (Phase 0013 indicates `src/renderer/ui/editor/inspector/PropertiesEditor.tsx`).
  - Locate where entity selection view models are created (Phase 0013 notes point to `src/renderer/ui/editor/map/mapViewModel.ts`).
  - Locate render-mode initialization and where `mapRenderMode` defaults are established (likely renderer store and/or main store snapshot).
  - Locate textured rendering code paths for walls/floors (per docs: `src/renderer/ui/editor/MapEditorCanvas.tsx`).
- **Done when:** A short “touch list” of files/functions is recorded in the Phase notes and the reproduction steps are written down.

## S002 — Fix entities manifest loading and option mapping for the dropdown
- **Intent:** The dropdown must list manifest entries and map them correctly to stored entity values.
- **Work:**
  - Ensure the manifest is loaded from the correct relative path under assets (`Entities/entities_manifest.json`) using `window.nomos.assets.readFileBytes` (L03).
  - Parse manifest JSON safely (validate that `files` is an array of strings).
  - Convert manifest `files` entries into dropdown options:
    - storeValue: whatever the map format expects (`defName`),
    - displayLabel: user-friendly name (e.g., base filename without extension).
  - Ensure the currently selected entity’s stored value is matched against these options and displayed.
  - Ensure fallback `(none)` is only used when the selected entity has no value or the value is not present in the manifest.
- **Done when:** Selecting an enemy shows its current entity definition and the dropdown contains all manifest options.

## S003 — Rename the Properties label from defName to Entity
- **Intent:** Improve UX and match requested terminology.
- **Work:**
  - Update the Properties UI field label for the entity definition dropdown to “Entity”.
  - Keep the underlying stored field name unchanged (`defName`) unless the map schema explicitly changes (out of scope).
- **Done when:** The label reads “Entity” everywhere this field appears.

## S004 — Ensure editing Entity commits correctly and remains undoable
- **Intent:** Fix correctness end-to-end (UI → map edit → persistence).
- **Work:**
  - Confirm dropdown selection commits via `window.nomos.map.edit(... map-edit/update-fields ...)` to update `defName`.
  - Verify baseRevision/stale handling remains correct (refresh on `map-edit/stale-revision`).
  - If any public method or IPC contract is adjusted, add/update unit tests to satisfy L04.
- **Done when:** Change Entity → Save + reopen preserves value; Undo/Redo restores previous value.

## S005 — Set mapRenderMode default to textured
- **Intent:** Map opens in the intended mode without user action.
- **Work:**
  - Identify where `mapRenderMode` is initialized (main store state and/or renderer store default).
  - Change the initial/default value to `textured`.
  - Update or add unit tests for the store layer if a public store API/default changes (e.g., `src/renderer/store/nomosStore.test.ts`).
- **Done when:** Opening a map yields textured mode by default and automated tests cover the default.

## S006 — Fix textured mode rendering to tile textures at a legible scale
- **Intent:** Remove the “single huge blurry texture” effect.
- **Work:**
  - Inspect textured rendering for floors/walls in `MapEditorCanvas`.
  - Replace “stretch to polygon bounds” behavior with repeat tiling using the appropriate Konva pattern/fill configuration.
  - Apply a consistent world-units-per-tile scale (use existing constant if present; otherwise define one shared constant and reuse it).
  - Ensure missing textures still fall back gracefully as documented (no huge placeholder fills).
- **Done when:** In textured mode, walls/floors show repeating textures that are legible at typical zoom.

## S007 — Docs update (only if behavior described becomes inaccurate)
- **Intent:** Keep subsystem documentation truthful (L09).
- **Work:**
  - Update `docs/renderer-ui-system.md` if it implies or states a default render mode, or if textured tiling behavior needs clarification.
- **Done when:** Docs reflect the implemented defaults/tiling behavior.

## S008 — Verification pass
- **Intent:** Complete the Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual smoke:
    - select multiple entities including enemies → Entity shows correct current value
    - change Entity → undo/redo → save/reopen
    - open map → textured is default
    - textured mode shows tiled, legible textures
- **Done when:** All automated checks pass and manual smoke results are recorded for Overseer review.
