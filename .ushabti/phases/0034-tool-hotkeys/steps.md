# Phase 0034 Steps — Tool Hotkeys

## S001 — Confirm shortcut mapping and interaction boundaries
- **Intent:** Remove ambiguity and prevent accidental UX regressions.
- **Work:**
  - Record decisions (if not already captured) for:
    - primary modifier per platform (macOS: Cmd, others: Ctrl)
    - index→key mapping for the two banks (1–10 and 11–20)
    - whether to support numpad digits in addition to top-row digits
    - ignore-hotkeys conditions when focus is in editable controls
    - where hotkeys are active (Map Editor toolbox only)
- **Done when:** `phase.md` reflects the decisions and acceptance criteria are unambiguous.

## S002 — Add a small hotkey-mapping module (pure functions)
- **Intent:** Keep UI code simple and make behavior unit-testable (L04/L08).
- **Work:**
  - Introduce a small module (renderer-side) that provides:
    - toolIndex → optional hotkey descriptor (none for index >= 20)
    - hotkey descriptor → platform-specific label string
    - `KeyboardEvent` → optional toolIndex (based on modifier/shift + `event.code`)
    - helper to detect “editable active element”
  - Ensure functions are typed and minimize condition-heavy UI code.
- **Done when:** The module has a clear, narrow public API and is ready to be used by the Toolbox UI.

## S003 — Track “modifier held” state for showing the overlay
- **Intent:** Make badges appear/disappear reliably.
- **Work:**
  - In the Map Editor toolbox owner component, add window-level `keydown`/`keyup` listeners to track whether the primary modifier is currently held.
  - Clear the state on `window.blur` to avoid a stuck overlay.
  - Ensure listeners are installed/removed correctly with React lifecycles.
- **Done when:** Overlay visibility toggles correctly in manual testing.

## S004 — Render pill badges over Toolbox tool buttons
- **Intent:** Provide the visual affordance described in DoD.
- **Work:**
  - Update the Toolbox button rendering so each tool can show an overlaid pill badge.
  - Badge must:
    - render only when overlay is visible and tool has a hotkey
    - be visually legible over the current dark UI
    - not interfere with clicking the tool buttons (pointer events behavior)
- **Done when:** Badges appear over the correct tools and do not break button layout.

## S005 — Implement keydown activation for tool selection
- **Intent:** Deliver fast tool switching.
- **Work:**
  - Listen for keydown events while Map Editor is mounted.
  - If the event matches a tool hotkey (platform modifier + digit + optional shift):
    - activate the corresponding tool id from `MAP_EDITOR_TOOLS[index]`
    - prevent default behavior as appropriate
  - Ensure no activation occurs when:
    - focus is in an editable element
    - tool index is out of range
- **Done when:** Each shortcut activates the correct tool without affecting text inputs.

## S006 — Verify mapping stays automatic as tools change
- **Intent:** Ensure the system remains maintenance-free.
- **Work:**
  - Ensure shortcuts and badges are assigned solely by iterating `MAP_EDITOR_TOOLS`.
  - Ensure tools beyond 20 do not display a badge and cannot be activated by number shortcuts.
- **Done when:** Adding/reordering tools in the registry automatically changes the assigned shortcuts.

## S007 — Unit tests for the hotkey mapping/parsing helpers (L04)
- **Intent:** Lock down the mapping logic and cover all conditional paths.
- **Work:**
  - Add Jest tests covering:
    - index→hotkey mapping for 0..19 and “none” for >=20
    - correct digit mapping including `0` as the 10th key
    - second bank requiring Shift
    - event parsing using `KeyboardEvent.code` (including Shift-number punctuation scenarios)
    - macOS vs Windows/Linux modifier detection paths
    - editable-active-element guard
- **Done when:** Tests cover all meaningful branches and pass.

## S008 — Update docs (L09)
- **Intent:** Keep subsystem docs current.
- **Work:** Update `docs/renderer-ui-system.md` to document:
  - Toolbox tool hotkeys (20 max) and mapping rules
  - badge overlay behavior on modifier hold
  - platform differences (Cmd vs Ctrl)
- **Done when:** Docs match the implemented behavior.

## S009 — Quality gates
- **Intent:** Keep repo green.
- **Work:** Run `npm test`, `npm run typecheck`, `npm run lint`.
- **Done when:** All gates pass.
