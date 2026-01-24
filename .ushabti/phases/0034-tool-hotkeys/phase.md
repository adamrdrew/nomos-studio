# Phase 0034 — Tool Hotkeys

## Intent
Add an automatic, cross-platform keyboard shortcut system for the **left Toolbox tools** in the Map Editor.

This Phase exists now because the tool system is already registry-driven (`MAP_EDITOR_TOOLS`) and users can benefit from fast tool switching without adding per-tool bespoke wiring.

## Scope

### In scope

- **Tool activation shortcuts (20 max)**
  - Support activating tools by holding the primary modifier and pressing a number key:
    - Tools 1–10: primary modifier + `1..9,0`
    - Tools 11–20: primary modifier + Shift + `1..9,0`
  - Tool ordering is derived automatically from the existing tool registry order (`MAP_EDITOR_TOOLS`).
  - Tools beyond 20 have no shortcut and show no badge.

- **Hotkey overlay badges**
  - While the primary modifier is held:
    - Show small pill/badge overlays on Toolbox buttons indicating the shortcut.
    - Badge content is platform-idiomatic:
      - macOS: `⌘1`, …, `⌘0`, and for tools 11–20: `⇧⌘1`, …, `⇧⌘0`.
      - Windows/Linux: `Ctrl+1`, …, `Ctrl+0`, and for tools 11–20: `Ctrl+Shift+1`, …, `Ctrl+Shift+0`.

- **Key handling correctness and safety**
  - Use `KeyboardEvent.code` (`Digit1`..`Digit0`, optionally `Numpad1`..`Numpad0`) so Shift-number shortcuts work reliably even when `event.key` is punctuation (e.g., `!` for Shift+1).
  - Hotkeys must not trigger while the user is typing in an editable control (`input`, `textarea`, `select`, or `contenteditable`).
  - Hotkeys must not crash in non-Map-Editor modes.

- **Documentation updates (L09)**
  - Update `docs/renderer-ui-system.md` to describe Toolbox tool hotkeys and the overlay-badge behavior.

- **Testing (L04/L08)**
  - Add unit tests for any new/changed **public** functions introduced to support hotkey mapping/parsing/labeling, covering all meaningful conditional branches.

### Out of scope

- Rebinding/customizing shortcuts.
- Hotkeys for toolbar commands (top toolbar) or menu items.
- Showing badges outside the Map Editor toolbox.
- Tool-specific keybindings (beyond “select tool by number”).

## Constraints

- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** macOS, Windows, and Linux behavior must be equivalent.
  - **L04 (Testing):** new/changed public methods must have unit tests covering conditional paths.
  - **L08 (Testability):** isolate platform-specific logic in small helpers so tests can cover both paths.
  - **L09 (Docs current):** update subsystem docs for new behavior.

- Must follow `.ushabti/style.md`:
  - Avoid new dependencies.
  - Prefer small, typed helpers; avoid scattering conditionals across UI.

## Phase decisions

- **Primary modifier:** macOS uses Command (`event.metaKey`), Windows/Linux uses Control (`event.ctrlKey`).
- **Tool ordering:** shortcut assignment is derived from `MAP_EDITOR_TOOLS` array order.
- **Shortcut mapping:**
  - Tool index 0 → `1`, …, index 8 → `9`, index 9 → `0`.
  - Tool index 10 → Shift+`1`, …, index 18 → Shift+`9`, index 19 → Shift+`0`.
- **Editable-focus guard:** if the active element is editable, hotkeys are ignored.

## Acceptance criteria

- **Badges show on modifier hold**
  - Holding Command (macOS) or Control (Windows/Linux) shows pill badges over Toolbox buttons.
  - Releasing the modifier hides the badges (including on window blur).

- **Correct labels (first 10 tools)**
  - For tools 1–10, the badge shows:
    - macOS: `⌘1`..`⌘9`, `⌘0`
    - Windows/Linux: `Ctrl+1`..`Ctrl+9`, `Ctrl+0`

- **Correct labels (next 10 tools)**
  - For tools 11–20, the badge shows:
    - macOS: `⇧⌘1`..`⇧⌘9`, `⇧⌘0`
    - Windows/Linux: `Ctrl+Shift+1`..`Ctrl+Shift+9`, `Ctrl+Shift+0`

- **Activation works**
  - With the Map Editor visible, pressing the corresponding shortcut activates the corresponding tool.
  - Tools beyond 20 do not activate via number shortcuts.
  - Shortcuts do not trigger while typing in a text field.

- **Quality gates**
  - `npm test` passes.
  - `npm run typecheck` passes.
  - `npm run lint` passes.

## Risks / notes

- Keyboard layout differences can cause `event.key` to vary; using `event.code` avoids most issues, including Shift-number punctuation on many layouts.
- Ensure the overlay state cannot get “stuck on” (handle keyup and window blur).
