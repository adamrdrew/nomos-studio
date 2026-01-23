# Phase 0028 — Sectors Start At 0

## Intent
Fix a map authoring bug where the first sector created in a fresh/empty map (seed room creation) is assigned sector id `1`. Sector ids must start at `0` and increment from there.

This Phase exists now because sector ids are part of the map’s core identity/reference model (selection, wall front/back sector links, serialization) and starting at `1` violates the expected on-disk invariant.

## Scope

### In scope
- Change seed room creation so that on an empty map the first created sector id is `0` (not `1`).
- Ensure subsequent created sectors continue to allocate deterministically as `max(id) + 1` (so the second sector becomes `1`).
- Update unit tests that assert seed sector selection and wall sector linkage.
- Update subsystem documentation that currently specifies the seed sector id as `1`.

### Out of scope
- Any migration/renumbering of existing map files on disk.
- Changing the representation of sector references (they remain numeric ids).
- Adding new UI controls, renderer behavior changes, or new edit commands.

## Constraints
- **L01 Desktop Cross-Platform Parity:** No platform-specific behavior; change must be pure logic.
- **L04 Testing Policy:** Any changed public behavior must be covered by unit tests for all affected branches.
- **L08 Design for Testability:** Keep logic deterministic and unit-testable (no new side-effect dependencies).
- **L09 Documentation:** Update the relevant docs under `docs/` to match the new invariant.

## Acceptance criteria
- Creating a seed room on an empty map allocates sector id `0` and selects `{ kind: 'sector', id: 0 }`.
- The created seed room’s walls use `front_sector: 0` and `back_sector: -1`.
- Creating a subsequent room after the seed room allocates sector id `1` (i.e., continues to use `max(id) + 1`).
- Jest, typecheck, and lint are green.
- `docs/map-edit-command-system.md` describes seed creation as starting at sector id `0`.

## Assumptions
- The external validator/game executable accepts sector ids starting at `0` (i.e., sector id `0` is valid and not treated as a sentinel).

## Risks / notes
- If any downstream logic (validator, renderer decode, or gameplay runtime) implicitly assumes sector ids are positive (> 0), this change could surface additional bugs. This Phase limits scope to the editor’s allocation behavior; any downstream incompatibility should be handled in a follow-up Phase once confirmed.
