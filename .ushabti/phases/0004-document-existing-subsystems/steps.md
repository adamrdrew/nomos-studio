# Phase 0004 Steps — Document Existing Subsystems

## S001 — Inventory subsystems and confirm doc targets
- **Intent:** Ensure the subsystem list is complete, consistent, and matches the current codebase.
- **Work:**
  - Walk `src/main`, `src/preload`, `src/renderer`, and `src/shared` to identify existing subsystems and their boundaries.
  - Confirm or adjust the Phase’s “Subsystems to document” list and doc filenames.
  - Record any scope clarifications (e.g., whether `process/` is currently meaningful).
- **Done when:** The subsystem list and doc filenames are finalized and match what exists in the repo.

## S002 — Create `docs/` and scaffold one doc per subsystem
- **Intent:** Establish a consistent, easy-to-maintain documentation home.
- **Work:**
  - Create `docs/` at repo root.
  - For each subsystem doc, add a skeleton with consistent headings:
    - Overview
    - Architecture
    - Public API / entrypoints
    - Data shapes
    - Boundaries & invariants
    - How to extend safely
    - Testing notes
- **Done when:** All doc files exist under `docs/` with the baseline structure.

## S003 — Document Settings subsystem
- **Intent:** Capture how settings are represented, persisted, and surfaced to users.
- **Work:**
  - Document the settings file shape/versioning expectations and where it lives.
  - Document main/preload/renderer responsibilities and the APIs used to read/write settings.
  - Document extension patterns (adding new settings safely) and testing expectations.
- **Done when:** `docs/settings-system.md` is accurate, complete, and references the real code entrypoints/types.

## S004 — Document Assets subsystem
- **Intent:** Make asset indexing and asset directory interactions understandable and extensible.
- **Work:**
  - Document asset indexing responsibilities, inputs/outputs, and any persistence/caching.
  - Document filesystem abstraction points (directory readers/indexers) and expected data shapes.
- **Done when:** `docs/assets-system.md` matches current implementation and clarifies extension points.

## S005 — Document Maps subsystem
- **Intent:** Capture map I/O and validation responsibilities and data boundaries.
- **Work:**
  - Document open/save/validate services and key invariants.
  - Document expected map data shapes (types, serialized formats as applicable) and error/result patterns.
- **Done when:** `docs/maps-system.md` accurately documents the current services and shapes.

## S006 — Document Store subsystem(s)
- **Intent:** Make state management clear across main and renderer.
- **Work:**
  - Document main-process store responsibilities and API surface.
  - Document renderer store responsibilities and how it consumes exposed APIs.
  - Document expected state shapes and update flows.
- **Done when:** `docs/app-store-system.md` is accurate and clearly describes boundaries.

## S007 — Document IPC subsystem
- **Intent:** Make the IPC contract explicit and safe to extend.
- **Work:**
  - Document the IPC channels, payload shapes, and ownership (main handler vs preload exposure vs renderer consumption).
  - Document security boundaries and extension rules (minimal surface area, typed payloads, no privileged access in renderer).
- **Done when:** `docs/ipc-system.md` lists the real channels/payload types and explains how to add new IPC safely.

## S008 — Document Windowing subsystem
- **Intent:** Make window creation/lifecycle and webPreferences constraints explicit.
- **Work:**
  - Document how main and settings windows are created and configured.
  - Document webPreferences, security-related settings, and lifecycle/ownership.
- **Done when:** `docs/windowing-system.md` reflects the actual window creation code paths and constraints.

## S009 — Document Menu subsystem
- **Intent:** Make menu structure and platform-specific behavior easy to maintain.
- **Work:**
  - Document how the application menu template is constructed.
  - Document platform-specific menu differences (e.g., macOS Preferences entrypoint conventions).
- **Done when:** `docs/menu-system.md` reflects the actual menu construction and extension points.

## S010 — Document Process subsystem
- **Intent:** Clarify any engine/process integration primitives and their boundaries.
- **Work:**
  - Document what exists under `src/main/infrastructure/process/` and its public surface.
  - Document constraints for safe process invocation (inputs, outputs, error handling, test seams).
- **Done when:** `docs/process-system.md` documents the real integration points without inventing future behavior.

## S011 — Document Renderer UI subsystem
- **Intent:** Make renderer responsibilities and integration points explicit.
- **Work:**
  - Document renderer entrypoints, how it interacts with preload APIs, and what it must not do (privileged operations).
  - Document data flow between renderer store and IPC.
- **Done when:** `docs/renderer-ui-system.md` clearly describes current renderer responsibilities and boundaries.

## S012 — Document Shared Domain subsystem
- **Intent:** Clarify shared primitives so they are reused consistently.
- **Work:**
  - Document shared domain types/utilities (e.g., `results`, `models`, `asyncSignal`) and how/when to use them.
  - Document invariants and expected usage patterns.
- **Done when:** `docs/shared-domain-system.md` accurately reflects the shared utilities and intended usage.

## S013 — Consistency pass and compliance check
- **Intent:** Ensure the docs set is complete and matches reality.
- **Work:**
  - Verify each doc’s “Public API / entrypoints” and “Data shapes” sections align with actual exported types and IPC payloads.
  - Ensure no subsystem is undocumented and no doc contradicts code.
  - Confirm the change set is documentation-only.
- **Done when:** All acceptance criteria in `phase.md` are satisfied.
