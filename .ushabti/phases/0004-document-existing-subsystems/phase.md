# Phase 0004 — Document Existing Subsystems

## Intent
Bring the repository into compliance with Law L09 by identifying all existing subsystems and producing clear, developer-level documentation for each under `docs/`.

This Phase is documentation-only: no new product development, behavior changes, refactors, or API expansion. The goal is to make the current architecture, API surfaces, and data shapes explicit so future Phases remain extensible and maintain quality.

## Scope

### In scope
- Create a `docs/` directory at the repository root.
- Identify the set of existing subsystems (based on current `src/` structure and execution boundaries: main/preload/renderer/shared).
- Write one doc per subsystem under `docs/`, at developer level, covering at minimum:
  - Purpose and responsibilities
  - High-level architecture and key design decisions
  - Public API surface area (entrypoints, exported types/functions/classes, IPC channels where relevant)
  - Expected data shapes (TypeScript types/interfaces, persisted JSON shapes, IPC payloads)
  - Key invariants/constraints (including relevant laws and security boundaries)
  - How to extend safely (common change patterns, where to add functionality, test expectations)
  - Non-goals / out-of-scope responsibilities (to preserve boundaries)
- Ensure docs match current implementation (no aspirational or future-state docs).

### Out of scope
- Any production code changes not required to make documentation accurate.
- Feature work, UX work, refactors, dependency changes.
- Adding new subsystems (this Phase documents what already exists).

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - L09 (Subsystem Documentation Is Required and Kept Current): docs live in `docs/`, one doc per subsystem, and must be updated to match the implementation.
  - L03 (Electron Security): documentation must correctly describe privilege boundaries (main/preload/renderer) and the IPC surface.
  - L04/L08: documentation should reflect the project’s testing and testability expectations for public APIs.
- Must follow `.ushabti/style.md` boundaries (domain/application/infrastructure/UI) when describing subsystem responsibilities.

## Subsystems to document (assumption)
This Phase treats each of the following as a subsystem requiring its own doc (file names are normative acceptance targets):
- `docs/settings-system.md` — settings domain/application/infrastructure persistence + Settings window integration
- `docs/assets-system.md` — asset indexing and asset directory reading/services
- `docs/maps-system.md` — map open/save/validate services and map data boundaries
- `docs/app-store-system.md` — main-process application store/state and renderer store contracts
- `docs/ipc-system.md` — IPC contract (channels, payload shapes), registration, preload API exposure
- `docs/windowing-system.md` — window creation (main/settings), web preferences, lifecycle
- `docs/menu-system.md` — application menu construction and Settings/Preferences entrypoints
- `docs/process-system.md` — process/engine integration primitives (if present) and how they’re safely invoked
- `docs/renderer-ui-system.md` — renderer entrypoint, state interactions, boundaries, and integration points
- `docs/shared-domain-system.md` — shared domain primitives (`results`, `models`, `asyncSignal`) and how they’re used

If any of these are discovered to be empty/non-subsystems, the inventory step must adjust the list explicitly (and update acceptance criteria accordingly).

## Acceptance criteria
- A `docs/` directory exists at repository root.
- The following files exist:
  - `docs/settings-system.md`
  - `docs/assets-system.md`
  - `docs/maps-system.md`
  - `docs/app-store-system.md`
  - `docs/ipc-system.md`
  - `docs/windowing-system.md`
  - `docs/menu-system.md`
  - `docs/process-system.md`
  - `docs/renderer-ui-system.md`
  - `docs/shared-domain-system.md`
- Each subsystem doc is developer-level and includes, at minimum:
  - an explicit “Public API / entrypoints” section
  - an explicit “Data shapes” section (TypeScript and/or JSON payloads)
  - an explicit “Boundaries & invariants” section
  - a short “How to extend safely” section
- Docs accurately reflect current implementation and do not contradict the codebase.
- No production behavior changes are introduced as part of this Phase (documentation-only change set).

## Risks / notes
- Subsystem boundaries may need minor adjustment during inventory (e.g., some responsibilities span `main/` and `shared/`). If adjusted, the new subsystem list must remain complete and remain one doc per subsystem.
- The `process` subsystem may be skeletal depending on current implementation; document what exists without inventing future behavior.
