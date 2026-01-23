# Steps — Phase 0028 (Sectors Start At 0)

## S001 — Confirm sector id invariant and validator compatibility
- **Intent:** Avoid shipping an editor change that produces maps rejected by the validator/runtime.
- **Work:**
  - Confirm (via existing schema/docs, or by validating a generated map) that sector id `0` is valid.
  - Record any constraints discovered (e.g., whether ids must be contiguous or non-negative).
- **Done when:** The team has an explicit statement that sector ids may start at `0` and must be non-negative integers.

## S002 — Locate seed-sector allocation point
- **Intent:** Make a minimal, targeted change at the root cause.
- **Work:**
  - Identify the code path that allocates `newSectorId` for `map-edit/create-room` when `placement.kind === 'room-placement/seed'`.
  - Identify any other code paths that allocate a sector id from an empty sector list.
- **Done when:** The exact allocation expression is identified and referenced in the implementation PR.

## S003 — Update seed allocation from `1` → `0`
- **Intent:** Fix the bug without changing non-seed allocation behavior.
- **Work:**
  - Change seed room creation to allocate sector id `0` on empty maps.
  - Keep existing deterministic behavior for non-empty maps: `max(id) + 1`.
- **Done when:** The seed creation code allocates `0` and the non-seed paths remain unchanged.

## S004 — Update/add unit tests for the new invariant
- **Intent:** Prevent regression and satisfy L04.
- **Work:**
  - Update the existing seed-room unit test to assert selection `{ kind: 'sector', id: 0 }`.
  - Update assertions for the created walls (`front_sector: 0`).
  - Add a regression test that creates a seed room and then creates a second room, asserting the second sector id is `1`.
- **Done when:** Unit tests explicitly cover the empty-map seed branch and the subsequent allocation behavior.

## S005 — Update documentation
- **Intent:** Keep subsystem docs aligned with implementation (L09).
- **Work:**
  - Update `docs/map-edit-command-system.md` “Create-room semantics” to state:
    - seed placement allocates sector id `0` on an empty map
    - otherwise allocates `max(id) + 1`
  - Update any other docs that reference the first sector id being `1`.
- **Done when:** Docs describe the new invariant and match tests/implementation.

## S006 — Verification gates
- **Intent:** Ensure repository remains green.
- **Work:**
  - Run `npm test -- --runInBand`.
  - Run `npm run typecheck`.
  - Run `npm run lint`.
- **Done when:** All tasks succeed.
