# Phase 0024 — Review Notes

## Quality gates
- `npm test` (Jest + coverage): PASS (34 suites, 350 tests)
- `npm run typecheck`: PASS
- `npm run lint`: PASS
	- Note: eslint prints a warning that the installed TypeScript version (5.9.3) is outside the officially supported range for `@typescript-eslint/typescript-estree`. This warning does not fail lint.

## Manual verification checklist
Manual verification completed on 2026-01-22.
- Verified editing walls and sectors via the new UI.
- Verified updated map in engine: works as expected.

The items below are the checklist that was exercised.

### Wall toggle fields (Inspector → Object Properties)
- [ ] Select a wall: `toggle_sector` checkbox is visible.
- [ ] With `toggle_sector` unchecked: toggle-related controls (`toggle_sector_id`, `toggle_sector_oneshot`, sounds) are hidden.
- [ ] With `toggle_sector` checked: shows `toggle_sector_id` dropdown, eye-dropper button, `toggle_sector_oneshot`, `toggle_sound`, `toggle_sound_finish`.
- [ ] Eye-dropper pick mode sets `toggle_sector_id` on the next sector selection and exits pick mode.
- [ ] Pick mode cancels via Escape and via clicking the button again.
- [ ] Undo/redo works for all wall toggle edits.
- [ ] Optional-field semantics: turning off `toggle_sector` removes related `toggle_*` keys from saved JSON (not `null`/`false`).

### Sector floor toggled position
- [ ] Select a sector: `floor_z_toggled_pos` dropdown is visible.
- [ ] Dropdown includes integer values -10..10.
- [ ] Selecting “(none)” removes `floor_z_toggled_pos` from saved JSON.
- [ ] Undo/redo works.

### View overlay: Highlight Toggle Walls
- [ ] View → Highlight Toggle Walls exists and is off by default.
- [ ] When enabled: walls with `toggle_sector === true` render with green overlay/highlight.
- [ ] When disabled: no green overlay.
- [ ] Overlay does not affect hit-testing/selection.
