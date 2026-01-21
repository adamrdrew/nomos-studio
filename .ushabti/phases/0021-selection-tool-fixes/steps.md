# Phase 0021 — Steps

## S001 — Locate and characterize current picking behavior
- **Intent:** Ground changes in the actual current implementation and reproduce the reported failure mode.
- **Work:**
  - Identify the Select-mode hit-testing function(s) and where they are invoked (currently `hitTestSelection` in the Map Editor canvas).
  - Reproduce the problem case (small wall near other walls/boundaries selecting sector) using an existing repro map or by creating a small temporary map fixture for manual verification.
  - Record the expected vs actual behavior in a short note (for the Overseer to verify).
- **Done when:** The exact code path and at least one concrete repro scenario is documented in the Phase notes / PR description.

## S002 — Define picking policy (rules and tie-breakers)
- **Intent:** Make selection behavior predictable and reviewable.
- **Work:**
  - Write down explicit rules for:
    - candidate set per kind (marker/door/wall/sector)
    - distance metric (screen-space distance preferred)
    - thresholds/slop values (including how they scale with zoom)
    - tie-breakers (e.g., closest wall wins; if equal, lowest index)
  - Ensure the policy matches “least surprise” and preserves sector selectability.
- **Done when:** Picking rules are written in the implementation docstring or in the Phase PR description and reflected in tests.

## S003 — Extract picking into a pure, testable module
- **Intent:** Enable unit tests and keep MapEditorCanvas UI code small.
- **Work:**
  - Move/refactor hit-testing logic into a dedicated renderer module (e.g., under `src/renderer/ui/editor/map/`).
  - Ensure the exported API is deterministic and does not depend on Konva events.
  - Keep inputs explicit (world point, view scale, render mode info if needed, map view model).
- **Done when:** MapEditorCanvas calls a pure function for picking, and the function can be invoked directly from unit tests.

## S004 — Improve wall picking robustness
- **Intent:** Fix the reported “click wall but select sector” cases.
- **Work:**
  - Adjust wall hit-testing to better reflect what the user visually perceives as the clickable wall area.
  - For textured mode, incorporate rendered wall strip thickness into hit slop (e.g., half thickness + margin), or use a point-in-strip / point-in-polygon test for the strip when feasible.
  - Keep selection stable in crowded geometry by choosing the best candidate wall using a consistent metric.
- **Done when:** Manual repro case now selects the intended wall, and tests demonstrate the corrected behavior.

## S005 — Add regression-focused unit tests for picking
- **Intent:** Prevent future regressions and satisfy L04 for any new public API.
- **Work:**
  - Add a dedicated test file for the picking module.
  - Cover conditional paths:
    - marker hit beats door/wall/sector
    - door hit beats wall/sector
    - wall hit beats sector
    - sector hit occurs when nothing else qualifies
    - multiple walls: closest wall wins
    - regression case: small wall near boundaries chooses wall, not sector
  - Use small synthetic maps (minimal vertices/walls/sectors) to keep tests readable.
- **Done when:** Tests fail on the previous implementation and pass on the new one, with clear assertions.

## S006 — Implement hover preview state in Select mode
- **Intent:** Provide immediate feedback about what will be selected.
- **Work:**
  - Track a `hoveredSelection` (or equivalent) while Select tool is active.
  - Update it on pointer move using the same picking function as click.
  - Clear it on mouse leave / when no map is loaded / when tool changes away from Select.
- **Done when:** Hover candidate is computed deterministically and updates smoothly during pointer movement.

## S007 — Render hover outline (yellow border)
- **Intent:** Make hover preview visible without interfering with existing selection outline.
- **Work:**
  - Add overlay rendering for `hoveredSelection` using a yellow stroke.
  - Reuse the existing selection overlay shapes where possible:
    - sector: loop outline
    - wall: polygon outline in textured mode, segment in wireframe
    - door/marker shapes: existing overlay geometry
  - Ensure red selection outline remains visible and has precedence when overlapping.
- **Done when:** Hovered object is visibly outlined in yellow, and selection remains outlined in red.

## S008 — Update renderer UI documentation (if needed)
- **Intent:** Keep subsystem documentation truthful (L09).
- **Work:**
  - Update `docs/renderer-ui-system.md` to mention:
    - improved picking expectations (least surprise)
    - hover preview outline behavior
    - any changed rules for wall hit thresholds (especially textured-mode)
- **Done when:** Docs match the new behavior and no longer imply the old behavior.

## S009 — Verification pass and quality gates
- **Intent:** Ensure the Phase ships green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manually validate:
    - selecting small walls in crowded areas works
    - selecting sectors still works
    - hover preview matches click selection
- **Done when:** All quality gates pass and manual checks match acceptance criteria.
