# Steps — Phase 0039: Wall Slice Tool (Split)

## S001 — Confirm touchpoints + invariants
**Intent:** Lock down scope boundaries and invariants before adding a new editing primitive.

**Work:**
- Identify the exact renderer files responsible for:
  - tool selection + tool bar rendering
  - wall picking / hovered selection
  - issuing `window.nomos.map.edit(...)` and applying selection effects
- Identify the exact main-process entry points for atomic commands in `MapCommandEngine`.
- Confirm and record invariants for:
  - portal walls (`back_sector > -1`)
  - door binding to `wall_index`
  - whether wall indices are assumed stable by other subsystems

**Done when:**
- Builder has a short note listing the concrete files/symbols and the confirmed invariants.

## S002 — Extend IPC contract: `map-edit/split-wall`
**Intent:** Add a typed command surface for wall splitting.

**Work:**
- Add `map-edit/split-wall` to the `MapEditAtomicCommand` union.
- Define request shape `{ wallIndex, at: { x, y } }`.
- Decide and document selection effect semantics for the split (default: set selection to `{ kind: 'wall', index: wallIndex }`).

**Done when:**
- The new command is represented in the shared IPC types and builds cleanly.

## S003 — Implement command in `MapCommandEngine`
**Intent:** Provide deterministic, validated wall splitting in the single source of truth.

**Work:**
- Add handling for `map-edit/split-wall`:
  - Validate indices and finiteness.
  - Reject portal walls and door-bound walls (per assumptions).
  - Compute closest split point on the segment.
  - Reject split points too close to endpoints.
  - Add/reuse a vertex for the split point.
  - Update existing wall in place and append a copied wall segment.
  - Preserve properties and avoid reordering arrays.

**Done when:**
- A split request results in a correct topology change and returns an applied result with the expected selection effect.

## S004 — Main-process unit tests for split-wall
**Intent:** Meet L04 and protect geometry edge cases.

**Work:**
- Add tests that cover all conditional paths:
  - successful split on a simple wall
  - split point projects to interior
  - rejection: invalid wall index
  - rejection: non-finite coordinates
  - rejection: portal wall
  - rejection: door-bound wall
  - rejection: endpoint/degenerate split (too close to v0/v1)

**Done when:**
- Tests are deterministic and cover all meaningful branches.

## S005 — Add Split tool definition (left tool bar)
**Intent:** Make the feature discoverable and selectable.

**Work:**
- Add `split` to the tool id union and tool definitions.
- Add a new interaction mode (e.g. `split`) and wire it through to the canvas.
- Ensure tool ordering integrates with the existing hotkey index mechanism.

**Done when:**
- Split appears as a tool and can be activated.

## S006 — Add a razor icon for the tool
**Intent:** Satisfy the UI requirement without breaking existing icon patterns.

**Work:**
- Determine whether an acceptable razor-like icon exists in the current icon set.
- If not, add a minimal local SVG icon and extend tool button rendering to support it.

**Done when:**
- The Split tool uses a razor icon consistently across platforms.

## S007 — Renderer interaction: click wall → request split
**Intent:** Trigger wall splitting from user clicks.

**Work:**
- When Split is active:
  - on pointer down/up (click), use existing picking logic to identify a wall hit.
  - compute the closest-point projection on the wall segment to derive the split point.
  - if the computed split point is too close to endpoints, do nothing (no request).
  - otherwise send one `window.nomos.map.edit(...)` request with `map-edit/split-wall`.
  - handle stale-revision errors consistently with other tools.

**Done when:**
- Clicking a wall with Split active reliably splits it and updates the view.

## S008 — Renderer pure helpers + tests (split point math)
**Intent:** Keep split-point computation testable (L08).

**Work:**
- Add/extend a small pure helper module for:
  - closest point on segment
  - endpoint proximity checks
- Add unit tests for edge cases (collinear, zero-length segment guard, near endpoints).

**Done when:**
- Helper APIs have tests covering branches and are used by the Split interaction.

## S009 — Documentation updates (L09)
**Intent:** Keep subsystem docs aligned with the new command/tool.

**Work:**
- Update docs/map-edit-command-system.md:
  - add the new command’s shape, validation rules, and semantics
- Update renderer UI docs:
  - describe the Split tool, its icon/label, and click-to-split behavior

**Done when:**
- Docs match the implemented behavior and file locations.

## S010 — Quality gates
**Intent:** Complete the Phase to green.

**Work:**
- Run `npm run lint`, `npm run typecheck`, `npm test`.

**Done when:**
- All gates pass.
