# Phase 0012 Steps — GUI Improvements

## S001 — Inspect current renderer layout + style sources
- **Intent:** Ground the fixes in how the current UI is composed (DockView, editor shell, toolbox, command bar) to avoid accidental regressions.
- **Work:**
  - Identify the components responsible for:
    - the Map Editor left toolbox and its tool buttons,
    - the Map Editor command bar (tool-dependent command row),
    - the DockView tab strip (Map Editor / Inspector tabs),
    - global/root layout sizing (html/body/root container).
  - Locate the existing theme primitives / Tailwind tokens used for these surfaces.
  - Note where the vertical scrollbar originates (html/body overflow, DockView container sizing, or a panel height mismatch).
- **Done when:** The exact component/style entry points are recorded (in step notes or as a short list of likely files to touch) and the scrollbar root cause is identified.

## S002 — Fix “UI taller than window” (remove app-level scrollbar)
- **Intent:** Make the Electron UI feel like a desktop app surface that fits the window.
- **Work:**
  - Adjust renderer root/container layout to ensure the editor shell fits the window height.
  - Remove/avoid any stray `min-height`/margins/padding that cause overflow.
  - Ensure Settings mode also fits without introducing scrolling unless the settings content genuinely requires it.
- **Done when:** Main window shows no persistent vertical scrollbar and trackpad scrolling does not scroll the entire editor UI.

## S003 — Toolbox width + full-width tool buttons
- **Intent:** Fix the left toolbox alignment and make it more space-efficient.
- **Work:**
  - Reduce toolbox width by ~10% relative to current.
  - Change tool button layout so each button stretches to the full toolbox width.
  - Keep the toolbox behavior consistent with docs (scrollable column is fine) but remove the “left-aligned floating button” look.
- **Done when:** Toolbox is narrower and every tool button visually spans the toolbox width.

## S004 — Toolbox + command bar contrast (white icons/text; matched backgrounds)
- **Intent:** Improve legibility while staying consistent with the existing dark editor aesthetic.
- **Work:**
  - Update toolbox icon styling to render white.
  - Adjust toolbox background to be slightly lighter than current without blending into the map grid.
  - Update the Map Editor command bar so:
    - text is white,
    - background matches the toolbox background color.
  - Use existing theme primitives / Tailwind tokens already present in the renderer (no new color palette introduced).
- **Done when:** Toolbox icons and command bar text are clearly legible; toolbox + command bar share the same background color family.

## S005 — DockView tabs: borders + tab affordance
- **Intent:** Make “Map Editor” and “Inspector” read as tabs, not plain text.
- **Work:**
  - Add borders and minimal tab styling to the DockView tab strip.
  - Ensure active vs inactive tab state is clear.
  - Keep styling scoped to DockView tabs (avoid unintended effects on other UI).
- **Done when:** Map Editor / Inspector headers look like idiomatic tabs with borders and clear selected state.

## S006 — Update renderer UI subsystem docs (L09)
- **Intent:** Keep docs truthful after UI behavior changes.
- **Work:**
  - Update `docs/renderer-ui-system.md` to reflect:
    - toolbox button stretching behavior (remove/adjust the statement that buttons do not stretch),
    - any other updated UI descriptions needed for accuracy.
- **Done when:** Docs match the implemented toolbox/command bar/tab behaviors.

## S007 — Verification (automated + manual)
- **Intent:** Complete the Phase to green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.
  - Manual smoke checklist:
    - no app-level vertical scrollbar at typical window sizes,
    - trackpad scroll does not move the entire UI surface,
    - toolbox buttons are full width and toolbox is ~10% narrower,
    - toolbox icons are white and readable,
    - command bar text is white and background matches toolbox,
    - Map Editor / Inspector tabs have borders and tab affordance.
- **Done when:** Automated checks pass and the manual checklist is confirmed.

## S008 — Manual UI confirmation (post-fixes)
- **Intent:** Explicitly confirm the last two UX concerns are resolved after the follow-up changes.
- **Work (manual):** In the running app, confirm:
  - toolbox tool icons are white and clearly legible,
  - DockView tabs have clear separation from the tab strip background (active tab is visibly distinct).
- **Done when:** The confirmation is recorded in `progress.yaml` notes (and any remaining UI tweaks are made if the check fails).
