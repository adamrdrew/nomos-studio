# Phase 0005 Steps — Begin Editor UI Creation

## S001 — Confirm UI structure and assumptions (DockView + overlay palette)
- **Intent:** Lock a minimal, spec-compliant UI plan before implementation details sprawl.
- **Work:**
  - Confirm the intended DockView panel composition:
    - Central: Map Editor
    - Right: Inspector (collapsibles)
  - Record the Phase assumption that the tool palette is a left-anchored overlay within the Map Editor panel.
  - Confirm minimal interaction expectations for tools (select may be no-op; pan/zoom must work).
- **Done when:** The chosen UI composition and assumptions are explicitly recorded in the Phase notes and reflected in subsequent steps.

## S002 — Replace bootstrap DockView with editor layout shell
- **Intent:** Establish the layout foundation future phases can extend.
- **Work:**
  - Update the renderer main UI to render a DockView layout with the required panels.
  - Remove/retire the current “Bootstrap Panel” example content.
  - Preserve Settings Mode routing behavior unchanged.
- **Done when:** App renders the editor shell in normal mode and Settings Mode still works.

## S003 — Implement Map Editor canvas (React Konva) with grid + view transform
- **Intent:** Create the central editing surface without yet rendering map content.
- **Work:**
  - Implement a Map Editor component using React Konva (`Stage`, `Layer`).
  - Render a graph-paper grid (assumption: thin minor lines and thicker major lines).
  - Add a view transform state:
    - scale (zoom)
    - translation (pan)
  - Add basic pointer/wheel handlers to update transform deterministically.
- **Done when:** The grid renders and can be panned/zoomed, with no map rendering.

## S004 — Add tool palette (select / zoom / pan) and wire interaction modes
- **Intent:** Introduce the first editor interaction concept: tool modes.
- **Work:**
  - Implement a skinny/tall palette UI on the left (within the Map Editor panel) with three buttons.
  - Store selected tool in renderer state.
  - Wire tool mode to interaction behavior:
    - Pan tool enables drag-to-pan.
    - Zoom tool enables wheel-to-zoom (or makes zoom the primary interaction).
    - Select tool disables pan-on-drag (no-op is acceptable).
- **Done when:** Tool selection is visible and pan/zoom behavior respects tool mode.

## S005 — Implement Inspector panel with collapsible sections
- **Intent:** Create the right-side extension surface for assets/properties.
- **Work:**
  - Implement an Inspector panel containing two collapsible sections:
    - Asset Browser
    - Properties
  - Properties is a placeholder component with no behavior.
- **Done when:** Both sections exist and can be expanded/collapsed.

## S006 — Build Asset Browser tree view from asset index
- **Intent:** Provide a VS Code-like hierarchical directory browser over the asset index.
- **Work:**
  - Read `settings.assetsDirPath` and `assetIndex` from the renderer store snapshot.
  - If assets are not configured, show centered text `Configure Assets in Settings`.
  - Convert `AssetIndex.entries` (relative POSIX paths) into a tree model (pure function preferred).
  - Render a navigable tree UI (expand/collapse directories).
  - Sort items alphabetically (assumption: directories first).
  - Display small icons based on file extension (minimum: `.json`, image files like `.png`, `.mid/.midi`, `.sf2`; default fallback).
  - Trigger an asset index refresh on mount when assets are configured but the index is missing/stale (implementation detail acceptable as long as no extra UX is introduced).
- **Done when:** Asset Browser meets the display requirements and reacts correctly to “assets not configured”.

## S007 — Add IPC + preload operation to open an asset in the OS
- **Intent:** Support double-click open without violating Electron security boundaries.
- **Work:**
  - Extend the shared IPC contract (`src/shared/ipc/nomosIpc.ts`) with a new channel for “open asset”.
  - Implement main-process handler wiring in `registerNomosIpcHandlers` and `main.ts` wiring.
  - Implement a main-process application service that:
    - reads `assetsDirPath` from `AppStore`
    - resolves and validates a requested relative path is within the assets base dir (defend against `..` traversal)
    - calls an injected adapter around Electron `shell.openPath`
    - returns a typed `Result<null, { message: string }>` (or a more specific typed error) suitable for the renderer
  - Expose a minimal preload wrapper and update `nomos.d.ts`.
- **Done when:** The renderer can request an open and main safely opens valid assets while rejecting invalid paths.

## S008 — Wire Asset Browser double-click to IPC open operation
- **Intent:** Complete the asset browsing UX requirement.
- **Work:**
  - On double-click of a file node, call the preload API to open it.
  - Ensure directories do not trigger open; they only expand/collapse.
  - Handle failures minimally (logging or non-blocking error surface; do not add extra UX beyond what’s required).
- **Done when:** Double-clicking a file attempts to open it using the OS default handler.

## S009 — Unit tests for new public APIs (L04)
- **Intent:** Keep the new IPC/service surface safe and regression-resistant.
- **Work:**
  - Add unit tests covering conditional paths for the new main-process service:
    - assets dir missing
    - valid relative path opens
    - invalid traversal path rejected
    - underlying `shell.openPath` failure propagated
  - Update/extend IPC handler registration tests if the channel list changes.
- **Done when:** `npm test` is green and tests cover all meaningful branches of new public methods.

## S010 — Update subsystem documentation (L09)
- **Intent:** Keep docs truthful and current as subsystems evolve.
- **Work:**
  - Update `docs/renderer-ui-system.md` to describe the editor layout, Map Editor canvas, tool palette, and Inspector structure.
  - Update `docs/ipc-system.md` with the new channel and preload API.
  - Update `docs/assets-system.md` to describe how the Asset Browser uses `AssetIndex` and how “open asset” is mediated.
- **Done when:** Docs reflect the implementation and list the new API surface accurately.

## S011 — Verification checklist + quality gates
- **Intent:** Make Phase completion easy to verify.
- **Work:**
  - Add a short checklist to the Phase notes (or `review.md` notes) for manual verification:
    - tool palette visible; tool changes state
    - pan/zoom works
    - inspector collapsibles work
    - asset browser shows configuration prompt when unset
    - asset browser tree renders when configured
    - double-click opens file
  - Run `npm run lint`, `npm run typecheck`, and `npm test`.
- **Done when:** Checklist exists and all three commands pass.

## S012 — Fix OpenAssetService base-dir validation edge cases
- **Intent:** Ensure the “open asset in OS” safety check is correct (rejects truly-outside paths without incorrectly rejecting valid in-base files).
- **Work:**
  - In `OpenAssetService.openAsset`:
    - Trim `assetsDirPath` before using it for `resolve/relative`.
    - Replace the current `relativeToBase.startsWith('..')` check with a stricter traversal check (e.g., `relativeToBase === '..'` or begins with `../` or `..\\`) to avoid false positives for valid filenames like `..foo`.
  - Extend unit tests in `OpenAssetService.test.ts` to cover:
    - in-base file named `..foo` (should be allowed)
    - assetsDirPath with surrounding whitespace (should behave the same as trimmed)
- **Done when:** New tests are present and passing, and the service no longer rejects in-base `..*` filenames.
