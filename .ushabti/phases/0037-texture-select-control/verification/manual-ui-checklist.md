# Phase 0037 — Manual UI verification checklist

This repo’s Jest config uses the `node` environment, so the visual picker behavior needs a quick in-app check.

## Preconditions
- Configure an assets directory containing textures under `Images/Textures/` (and/or `Assets/Images/Textures/`).
- Include at least 20+ textures to validate scrolling.

## Checklist

### Picker UX
- [ ] Texture picker opens from a compact closed state.
- [ ] Picker shows a scrollable grid of texture thumbnails.
- [ ] Grid remains responsive while scrolling.
- [ ] Selecting a texture closes the picker and updates the value.
- [ ] Missing/unloadable textures render a placeholder and do not crash.

### Inspector: Door texture
- [ ] Empty selection shows `(select texture)`.
- [ ] Clearing door texture unsets `tex` (MAP_EDIT_UNSET semantics).

### Inspector: Wall texture
- [ ] Selecting a texture commits immediately and updates the wall.

### Inspector: Sector floor/ceiling
- [ ] Floor/ceil pickers show thumbnails.
- [ ] Skybox toggle behavior is unchanged (ceil picker hidden when Skybox is on).

### Inspector: Texture Walls
- [ ] Picker allows `(none)` and `(mixed)` entries.
- [ ] Choosing a texture does not commit until pressing **Set**.
- [ ] **Set** enable/disable logic matches prior behavior.

### Settings: Default textures
- [ ] Default wall/floor/ceil texture pickers show thumbnails.
- [ ] `(none)` persists as `null` after Apply/Done and survives restart.

## Recording
- When complete, update `progress.yaml` step S011 notes with the date and any issues found.
