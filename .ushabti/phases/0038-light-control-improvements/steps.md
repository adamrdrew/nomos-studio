# Steps — Phase 0038: Light Control Improvements

## S001 — Confirm touchpoints and interaction rules
**Intent:** Anchor implementation to existing light rendering, selection, and edit pathways.

**Work:**
- Identify where lights are rendered and where selection/drag logic lives.
- Confirm how light radius and color are currently committed (use of `map-edit/update-fields`).
- Record any edge cases (missing lights array, invalid radius) that the UI must handle gracefully.

**Done when:**
- Builder has a short note listing the exact files/symbols to change and the final interaction rules for radius dragging.

## S002 — Add pure helpers for radius handle geometry + hit testing
**Intent:** Keep resizing logic testable and deterministic (L08).

**Work:**
- Add a small renderer helper module that:
  - computes the handle world position for a light
  - determines whether a pointer world point is “on the handle” given a pixel hit radius + view scale
  - computes the new radius from center→pointer distance
  - clamps/guards invalid inputs

**Done when:**
- Helpers are exported and used by the canvas implementation.

## S003 — Render the resize handle for the selected light
**Intent:** Provide a clear, discoverable affordance.

**Work:**
- In the map canvas light rendering:
  - when the current selection is a light, render the handle dot at the computed position.
  - ensure handle size is screen-pixel consistent (convert px→world using view scale).
  - apply a distinct visual style (stroke/fill) that reads against the map.

**Done when:**
- Handle dot reliably appears only for the selected light and remains readable across zoom levels.

## S004 — Implement drag interaction to resize radius
**Intent:** Allow direct manipulation without breaking other tools.

**Work:**
- Add an internal “resizing light” drag state in the canvas.
- On pointer down:
  - if selection is a light and the pointer hits the handle, start resize-drag.
- On pointer move:
  - update a local preview radius for that light.
- On pointer up:
  - commit a single `map-edit/update-fields` edit for `radius`.
- Ensure resize-drag has higher priority than move-drag, and does not trigger pan/zoom.

**Done when:**
- Dragging the handle previews and commits radius correctly, with no accidental mode leakage.

## S005 — Unit tests for radius handle helpers
**Intent:** Meet L04 for new public helpers and protect edge cases.

**Work:**
- Add tests that cover:
  - handle position computation
  - hit-testing success/failure across scales
  - radius computation + clamping

**Done when:**
- Tests are deterministic and cover all branches of the exported helper API.

## S006 — Create a reusable gradient Color Picker control (renderer)
**Intent:** Replace raw RGB entry with a visual picker.

**Work:**
- Implement a small renderer control that:
  - shows current color swatch
  - opens a picker surface with a gradient-based selection UI (e.g., hue slider + 2D gradient)
  - returns an `{ r, g, b }` (0..255) or `#RRGGBB` selection to the caller
- Avoid adding new dependencies unless absolutely necessary.

**Done when:**
- The control can be embedded in Light properties and produces stable RGB/hex output.

## S007 — Integrate Color Picker into Light Object Properties
**Intent:** Make light color editing fast and friendly.

**Work:**
- Replace the Light editor’s three RGB inputs with the new Color Picker.
- Commit edits via `map-edit/update-fields` with `color: "#RRGGBB"`.
- Keep any existing validation behavior (finite checks, clamping to 0..255).

**Done when:**
- Picking a color updates the map immediately (on commit) and the canvas tint matches.

## S008 — Unit tests for color conversion helpers
**Intent:** Ensure color math stays correct and testable.

**Work:**
- If the Color Picker introduces exported helpers (HSV↔RGB, hex parsing/formatting, clamping), add unit tests covering:
  - valid conversions
  - boundary values (0/255)
  - invalid inputs (non-finite)

**Done when:**
- Helper APIs have full branch coverage.

## S009 — Update docs (L09)
**Intent:** Keep subsystem documentation aligned with new UX.

**Work:**
- Update renderer UI docs to describe:
  - the selected-light radius handle and its tool interaction constraints
  - the light color picker and stored `#RRGGBB` format

**Done when:**
- Documentation reflects the implemented behavior and file locations.

## S010 — Quality gates
**Intent:** Ensure Phase completes to green.

**Work:**
- Run `npm run lint`, `npm run typecheck`, `npm test`.

**Done when:**
- All gates pass.

## S011 — Match editor light radius visuals to runtime
**Intent:** Reduce mismatch between editor radius circles and runtime lights.

**Work:**
- Scale the rendered light radius circle (and resize handle position) to 0.5× of the stored light radius.
- Ensure radius-handle dragging still commits the correct stored `radius` value (i.e., convert between displayed radius and stored radius on drag).
- Update renderer UI docs so handle placement and behavior match implementation.

**Done when:**
- Light radius circles in the editor appear half the previous size and the resize-handle interaction remains intuitive (dragging the handle changes the displayed radius directly).
