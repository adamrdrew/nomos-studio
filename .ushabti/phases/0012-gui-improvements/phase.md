# Phase 0012 — GUI Improvements

## Intent
Improve the editor’s “desktop app” feel and legibility by fixing five concrete UI issues:
1) left toolbox buttons fill the toolbox width and the toolbox is ~10% narrower,
2) eliminate the app-level vertical scrollbar by making the UI fit the window height,
3) increase left toolbox contrast (white icons, slightly lighter background),
4) fix command bar text contrast (white text; match toolbox color),
5) make the Map Editor / Inspector headers visually read as tabs (borders, idiomatic tab affordance).

This Phase exists now because these issues noticeably reduce usability and make the Electron app feel like a scrollable web page rather than a desktop tool.

## Scope

### In scope
- Renderer-only layout and styling changes for:
  - the Map Editor left toolbox (“tool buttons”):
    - buttons stretch full width (not left-aligned),
    - toolbox width reduced by ~10% relative to current,
    - icon color updated to white,
    - background color adjusted slightly lighter while still distinct from the dark map grid.
  - the Map Editor command bar (tool-dependent commands row):
    - text color changed to white,
    - background color matched to the toolbox background.
  - the DockView tab strip for core panels (Map Editor / Inspector):
    - tabs have visible borders and read as tabs.
- Fix the renderer root layout so the app surface fits the BrowserWindow height without creating a vertical scrollbar.
- Update subsystem docs impacted by these UI behavior changes (L09).
- Verification: `npm test`, `npm run typecheck`, `npm run lint`, plus manual UI smoke checks focused on the above issues.

### Out of scope
- New tools, new toolbar commands, new panels, or any DockView layout behavior changes.
- Any new theme system, custom design language, icons, or new color palette additions.
- Adding renderer component tests (repo currently relies on manual renderer verification per docs).
- Changing main-process window sizing behavior or adding new windows.

## Constraints
- L03 (Electron security posture): this Phase must not add or widen preload APIs; changes are renderer layout/styling only.
- L09 (Docs): update `docs/renderer-ui-system.md` (and any other docs that become inaccurate) to reflect the adjusted toolbox/tab/toolbar behavior.
- Style guide:
  - Keep boundaries explicit (renderer-only changes stay in renderer).
  - Avoid introducing new dependencies.
  - Prefer existing Tailwind tokens / theme primitives already used in the renderer; do not hard-code new, arbitrary colors.

## Acceptance criteria
- **Toolbox width + button alignment**
  - Left toolbox (tool buttons column) is visibly narrower than before by approximately 10%.
  - Each tool button occupies the full toolbox width (no left-aligned “floating” buttons).

- **No app-level vertical scrolling**
  - With the main window at any typical size, the app does not show an always-present vertical scrollbar.
  - Trackpad scrolling does not scroll the entire UI surface; the editor shell remains fixed to the window height.

- **Toolbox legibility**
  - Toolbox tool icons render in white and are clearly legible.
  - Toolbox background is slightly lighter than current while still visually separated from the map grid.

- **Command bar legibility**
  - Command bar text renders in white and is readable.
  - Command bar background matches the toolbox background color (same family/level).

- **Tabs look like tabs**
  - “Map Editor” and “Inspector” headers have borders and read as idiomatic tabs (not just plain text labels).
  - Active vs inactive tab state is visually clear without introducing new UI concepts.

- **Docs + checks**
  - `npm test`, `npm run typecheck`, `npm run lint` all pass.
  - `docs/renderer-ui-system.md` no longer contains statements that contradict the updated UI (e.g., toolbox button stretching behavior).

## Risks / notes
- DockView tab styling may be governed by a library theme/CSS layer; changes should be minimal and scoped to avoid unintended global styling.
- Eliminating vertical scrolling must not break Settings mode layout; ensure both “editor shell mode” and “settings mode” still fit the window.
- “~10% narrower” is interpreted as relative to the current toolbox width, not the entire window width.
