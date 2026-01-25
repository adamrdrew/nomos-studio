# Phase 0038 — Light Control Improvements

## Intent
Improve the UX of authoring lights by adding two direct-manipulation affordances:
1) A draggable radius handle on selected lights to resize with the mouse.
2) A visual color picker (gradient-based) in Object Properties, replacing raw RGB numeric entry.

This Phase exists now because lights are already create/select/move/editable (Phase 0036), but adjusting radius and color is still slower and more error-prone than it needs to be.

## Scope

### In scope

#### A) Canvas: light radius resize handle (selected light)
- When a light is selected, render a **grabbable handle dot** on the **outer edge** of the light radius circle.
- Dragging the handle resizes the light by changing `lights[].radius`.
- While dragging:
  - The radius circle updates live (preview) so the user can see the resulting size.
  - No map edits are committed continuously (commit once on drag end).
- On drag end (mouse up): commit exactly one main-process map edit via the existing typed IPC path (L03).
  - Use `map-edit/update-fields` with `{ radius: <number> }`.
  - Undo/redo must work as it does for other updates.

Assumptions (recorded for Builder/Overseer):
- The editor displays the light radius circle at **0.5×** the stored `radius` to better match runtime visuals.
- The handle is positioned on the displayed circle at `(x + radius * 0.5, y)` in authored world space (i.e., on the +X side of the displayed circle).
- Handle interaction is enabled when:
  - a light is selected, and
  - the active tool/interaction mode is `select` or `move`.
  (It is disabled for `pan`, `zoom`, `door`, `room`, and `light-create` to avoid mode conflicts.)

#### B) Inspector: gradient color picker for lights
- In Inspector → Object Properties, when a light is selected:
  - Replace the current **three numeric RGB inputs** with a **visual gradient color picker**.
  - The picker must allow selecting any RGB color where each component is in `[0, 255]`.
- Committing color edits:
  - Commit through `map-edit/update-fields` (L03).
  - Store the value as a hex string `#RRGGBB` (consistent with current create defaults and decoder support).
- The UI should still display the current color clearly (e.g., a swatch + hex readout).

#### C) Documentation updates (L09)
- Update renderer UI documentation to describe:
  - the radius resize handle behavior and how it interacts with tools
  - the new light color picker control and its storage format (`#RRGGBB`)

#### D) Testing (L04/L08)
- Add unit tests for any new/changed **public** functions introduced to support:
  - handle geometry/hit-testing and radius calculation
  - color conversion helpers used by the picker

### Out of scope
- Changing the map edit command surface (no new `map-edit/resize-light` command in this Phase).
- Multi-handle support (e.g., resizing from any angle) or modifier-key snapping.
- Changing light rendering semantics beyond the authoring UI (no gameplay/runtime changes).
- Changing the stored map schema for lights beyond setting `color` to `#RRGGBB` via update-fields.
- Adding search/history/palette features to the color picker.

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** handle interactions must behave equivalently on macOS/Windows/Linux.
  - **L03 (Electron security):** all mutations occur via typed preload/IPC map edits.
  - **L04 (Testing):** new/changed public methods have tests covering conditional paths.
  - **L08 (Testability):** isolate hit-testing and color math behind pure helpers.
  - **L09 (Docs current):** renderer UI docs updated in the same change.
- Must follow `.ushabti/style.md`:
  - Keep UI changes within renderer/UI modules.
  - Avoid new dependencies unless clearly necessary; prefer small focused modules.
  - Prefer typed, explicit helpers over ad-hoc conditionals in components.

## Acceptance criteria

### Radius resize handle
- Selecting a light renders a visible handle dot on the outer edge of its radius circle.
- Clicking and dragging the handle changes the radius smoothly, with a live visual preview.
- Releasing the mouse commits exactly one edit that updates `radius` for that light via `map-edit/update-fields`.
- Undo/redo correctly restores the prior radius.
- Resizing does not interfere with pan/zoom/room/door/light-create interactions.

### Color picker
- The Light Object Properties panel shows a gradient-based color picker (not raw RGB numeric inputs).
- Picking a color commits `color: "#RRGGBB"` via `map-edit/update-fields`.
- The chosen color persists through Save + reopen and displays correctly in the canvas (radius fill/stroke tint).

### Docs + quality gates
- Renderer UI docs updated (L09).
- `npm run lint`, `npm run typecheck`, and `npm test` pass.

## Risks / notes
- **Tool interaction conflicts:** dragging the handle must not accidentally trigger move/pan; implementation should treat handle-drag as an explicit mode while active.
- **Precision / jitter:** radius computation should use authored world coordinates and clamp to sane values (e.g., `>= 0`).
- **Jest environment:** UI interaction tests may be limited; focus tests on pure helper logic.
