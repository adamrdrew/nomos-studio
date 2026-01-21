# Phase 0021 — Selection Tool Fixes (Hit-Testing + Hover Preview)

## Intent
Make Select-mode picking behave by the principle of least surprise: when the cursor is near/over a wall (including small walls near other walls and sector boundaries), clicking should select the wall instead of the sector.

Add a hover preview: while the Select tool is active, draw a **yellow border** around the object currently under the cursor (the object that would be selected on click).

This Phase exists now because current select hit-testing can miss the intended wall and fall through to sector selection, which feels wrong and slows editing.

## Scope

### In scope
- Improve Select-mode hit-testing in the renderer so walls are reliably selectable even in crowded geometry (small wall segments near other walls and/or sector boundaries).
- Ensure the thing highlighted on hover is exactly what will be selected on click (same picking logic).
- Add hover-preview rendering:
  - yellow outline/border around hovered candidate
  - does not replace the existing red outline for the active selection
- Add/extend automated tests for picking logic (pure unit tests).
- Update docs under `docs/` if the renderer selection behavior description becomes inaccurate.

### Out of scope
- Adding new tools or changing tool UX beyond hover preview and improved picking.
- Changing map formats, map validation, or any main-process selection reconciliation rules.
- Adding renderer e2e tests (not currently a pattern in this repo).
- Introducing new dependencies.

## Constraints
- **L01 (Cross-platform parity):** Picking and hover behavior must be consistent across macOS/Windows/Linux.
- **L03 (Electron security):** Renderer-only changes; do not widen preload/IPC surface.
- **L04 (Testing):** Any newly introduced/changed public method must have unit tests covering all conditional paths.
- **L08 (Design for testability):** Hit-testing should remain pure/deterministic and easily testable (no Konva/Event coupling).
- **L09 (Docs):** Update `docs/renderer-ui-system.md` if its Select-mode hit-testing description becomes stale.

## Assumptions (explicit)
- Current picking priority remains: **markers > doors > walls > sector**.
- The reported failure mode is caused by wall hit-testing being too strict in some cases (e.g., textured wall strips thicker than the hit threshold at certain zoom levels, or small wall segments requiring more forgiving hit slop).
- Hover preview appears only when Select tool is active, and it highlights the current pick candidate even if something else is already selected.
  - If the hovered candidate equals the current selection, the preview may be suppressed to avoid double-outlining (implementation choice).

## Acceptance criteria

### Correctness: wall selection vs sector selection
- In Select mode, clicking on/near a wall that is visibly under the cursor selects the wall (not the sector), including:
  - short/small wall segments
  - walls near other walls (crowded boundaries)
  - walls adjacent to sector boundaries (including portals)
- Sector selection still works:
  - clicking well inside a sector (not near any wall/door/marker) selects the sector

### Correctness: textured-mode walls
- In textured mode, clicking within the rendered wall strip area selects the corresponding wall (no “click the strip but get the sector” behavior).

### Hover preview behavior
- With Select tool active, moving the mouse shows a yellow outline around the object that would be selected if the user clicked.
- The hover-highlighted object matches click selection for the same pointer location.
- Hover outline disappears when the pointer is not over a selectable object.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Unit tests cover the key picking branch outcomes (including at least one regression test for the “small wall near boundaries selects sector” scenario).

## Risks / notes
- If wall hit-testing is loosened too much, users may find it difficult to select sectors in narrow spaces; mitigations include:
  - choosing the *closest* wall by screen-distance when multiple are candidates
  - limiting wall slop to the rendered wall thickness (textured) + a small margin
- If hover rendering adds significant per-frame work, it could affect performance on large maps; implement hover pick computation efficiently and avoid unnecessary allocations.
