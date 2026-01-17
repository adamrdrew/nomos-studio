# Phase 0011 Review — Move Entity Tool

## Summary

Phase intent is implemented (Move tool + main-process move command + history/revision integration). Engine unit tests cover move-entity success and expected failure branches (including invalid indices). Automated verification is recorded, and manual smoke (UI + save/reopen) is now confirmed.


## Verified

- **L03 (Electron security boundary):** Renderer commits moves via existing preload API (`window.nomos.map.edit`) and does not introduce new privileged surfaces. Main process remains the authoritative map mutator.
- **Move command wiring:** Shared IPC contract includes `map-edit/move-entity` and main `MapCommandEngine` applies it deterministically by updating only `entities[index].x/y`.
- **Engine tests (L04):** `MapCommandEngine` unit tests now cover move-entity success and expected failure cases.
- **Stale-edit handling:** Renderer handles `map-edit/stale-revision` on commit by refreshing snapshot and clearing preview; main rejects stale `baseRevision` before mutating store/history.
- **Undo/Redo + revision/metadata:** `MapEditService` treats move like other edits: bumps revision, marks dirty, clears validation, records history; `MapEditService` unit tests pass (locally ran `npm test -- MapEditService.test.ts`).
- **Docs (L09):** Map edit command doc and renderer UI doc reflect the new command/tool at a high level.
- **Save semantics (acceptance support):** `SaveMapService` serializes `document.json` and writes it to disk, and has existing unit tests that cover “writes JSON and clears dirty”. This supports the save/reopen acceptance criterion once manual smoke confirms end-to-end UI flow.

- **Approved exception (scope):** `.github/agents/ushabti-builder.agent.md` and `.github/agents/ushabti-overseer.agent.md` have intentional changes (user-approved) and are retained.


## Issues

No open issues.


## Required follow-ups

None.


## Decision

Green.

```

