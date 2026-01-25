# Phase 0037 — Manual UI verification checklist

This repo’s Jest config uses the `node` environment, so the visual picker behavior needs a quick in-app check.

## Preconditions
- Configure an assets directory containing textures under `Images/Textures/` (and/or `Assets/Images/Textures/`).
- Include at least 20+ textures to validate scrolling.

## Checklist

### Picker UX
- [x] Texture picker opens from a compact closed state.
- [x] Picker shows a scrollable grid of texture thumbnails.
- [x] Grid remains responsive while scrolling.
- [x] Selecting a texture closes the picker and updates the value.
- [x] Missing/unloadable textures render a placeholder and do not crash.

### Inspector: Door texture
- [x] Empty selection shows `(select texture)`.
- [x] Clearing door texture unsets `tex` (MAP_EDIT_UNSET semantics).

### Inspector: Wall texture
- [x] Selecting a texture commits immediately and updates the wall.

### Inspector: Sector floor/ceiling
- [x] Floor/ceil pickers show thumbnails.
- [x] Skybox toggle behavior is unchanged (ceil picker hidden when Skybox is on).

### Inspector: Texture Walls
- [x] Picker allows `(none)` and `(mixed)` entries.
- [x] Choosing a texture does not commit until pressing **Set**.
- [x] **Set** enable/disable logic matches prior behavior.

### Settings: Default textures
- [x] Default wall/floor/ceil texture pickers show thumbnails.
- [x] `(none)` persists as `null` after Apply/Done and survives restart.

## Recording
- When complete, update `progress.yaml` step S011 notes with the date and any issues found.

Completed: 2026-01-25 (no issues found)
