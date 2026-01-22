# Phase 0023 — Nested Sector Selection (Deepest Sector Hit-Test)

## Intent
Fix Select-mode sector picking so **sectors contained within other sectors** (pits, pillars, platforms) can be hovered and selected.

Today, when the cursor is over an inner sector, the Select tool highlights and selects the outer sector instead. This Phase makes hover preview and click selection choose the **most specific** sector under the cursor, while preserving the ability to select the outer sector when the cursor is in the outer-only area.

## Scope

### In scope
- Update Select-mode picking for **sectors** so that when a point lies inside multiple sectors:
  - hover preview highlights the **deepest/innermost** sector
  - click selects the **same** deepest/innermost sector
- Preserve the existing priority order from Phase 0021 (markers > doors > walls > sectors). This change only applies once we are in the sector-picking fallback.
- Add/extend unit tests for the picking logic to cover nested-sector cases.
- Update renderer subsystem docs if the selection behavior description needs a tweak.

### Out of scope
- Any UI change to support “cycling” selection through overlapping candidates (e.g., repeated click to cycle).
- Changes to wall/door/entity hit-testing or thresholds beyond what is required to keep sector selection consistent.
- Map format changes or validator changes.
- Renderer e2e tests.

## Constraints
- **L01 (Cross-platform parity):** Picking must be deterministic and consistent across macOS/Windows/Linux.
- **L03 (Electron security):** Renderer-only behavior change; do not widen preload/IPC surface.
- **L04 (Testing):** Any changed/added public picking API must have unit tests covering all conditional paths introduced by nested-sector handling.
- **L08 (Design for testability):** Nested-sector decision logic must remain pure/deterministic and unit-testable (no Konva/Event coupling).
- **L09 (Docs):** Update `docs/renderer-ui-system.md` if its Select-mode behavior becomes inaccurate.

## Assumptions (explicit)
- Map geometry may contain sectors strictly nested within other sectors; this is considered valid and used for pits/pillars/platforms.
- For valid maps, “multiple sectors contain the same point” occurs primarily due to **strict nesting**, not arbitrary polygon overlap.
- Sector “containment” in picking is based on the same point-in-polygon test currently used for sector selection.

## Picking policy addition: nested-sector tie-breaker
When sector picking is reached (no marker/door/wall hit):
- Compute all sectors whose polygon contains the cursor point.
- If exactly one sector contains the point: pick it.
- If multiple sectors contain the point: pick the **deepest / most specific** sector.

### Deepest-sector definition (deterministic tie-breakers)
For nested sectors, “deepest” can be determined by either of these equivalent methods:
- **Preferred:** choose the sector with the greatest containment depth (contained by the most other containing sectors).
- **Permitted simplification (if overlap is not expected):** choose the containing sector with the **smallest absolute polygon area**.

If still tied (e.g., equal area within epsilon, or ambiguous geometry): choose the sector with the lowest stable identifier (e.g., sector index).

## Acceptance criteria

### Hover + click correctness
- With Select tool active, when hovering inside an inner sector that is contained within an outer sector:
  - the yellow hover outline is drawn around the **inner** sector
  - clicking selects the **inner** sector
- When hovering/clicking in the outer sector region that is not part of any inner sector:
  - the hover outline is drawn around the **outer** sector
  - clicking selects the **outer** sector
- Hover-highlighted object matches click selection for the same pointer location.

### Non-regression
- Existing picking priority remains: marker/door/wall selection behavior is unchanged.
- Sector selection still works when clicking well inside a sector (including concave sectors) and when no nested sector is under the cursor.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Unit tests include at least one regression case demonstrating nested sectors now pick the inner sector.

## Risks / notes
- If maps can contain **overlapping but not nested** sectors (invalid geometry), “smallest area wins” may produce surprising results; mitigate by using the depth-based method or by documenting overlap as undefined behavior.
- Performance: checking containment for many sectors per mouse move could be expensive on very large maps; keep it efficient and avoid allocations on the hot path.
