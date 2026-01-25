# Phase 0036 — Light Creation Tool

## Intent
Add a new **Light tool** to the Map Editor toolbox (left-side tool column) that puts the editor into **Create Light Mode**. In this mode the cursor communicates whether a click will create a light, and clicking inside a sector creates a new point light.

This Phase exists now because:
- The editor already supports selecting/moving lights and editing their basic properties.
- Tool hotkeys (Phase 0034) are registry-driven, so adding a tool should automatically participate.
- Authors need an ergonomic workflow to add lights without manual JSON editing.

## Scope

### In scope

#### A) Toolbox: new Light tool
- Add a toolbox button for a new **Light tool**.
- The button uses a **light bulb icon** and an appropriate tooltip (e.g., “Light”).
- Activating the tool switches the canvas into **Create Light Mode**.

#### B) Hotkey integration
- The Light tool must automatically participate in the existing tool-hotkey system (derived from `MAP_EDITOR_TOOLS` ordering).
- The tool must display the hotkey badge overlay like other tools.

#### C) Cursor feedback (valid vs invalid placement)
When Create Light Mode is active:
- If the cursor is **outside any sector**, show a negative cursor.
  - On macOS, the cursor should be an **X** (as requested).
  - On Windows/Linux, use an idiomatic “blocked/not allowed” cursor (or an equivalent treatment).
- If the cursor is **inside a sector**, show an affirmative cursor.
  - On macOS, show a **green plus** (as requested).
  - On Windows/Linux, use an idiomatic “copy/plus” cursor (or an equivalent treatment).

Notes:
- Sector containment must use the editor’s canonical containment logic (`pickSectorIdAtWorldPoint` / nested-sector-aware rules), not an ad-hoc implementation.

#### D) Click to create a light
- In Create Light Mode, clicking inside a sector creates a new light at the click position.
- Creation is performed via a **typed main-process map edit command** (L03).
- On success:
  - the document becomes dirty and revision bumps,
  - undo/redo works,
  - selection is set to the newly created light.
- Clicking outside any sector does nothing (no crash).

#### E) Light Properties editor: flicker field
- When a light is selected, the Inspector Properties panel must allow editing a `flicker` field with **valid options only**.
- Valid options are: `none`, `flame`, `malfunction`.
- “None” should be represented using the editor’s standard optional-field convention (prefer omitting the JSON key via `MAP_EDIT_UNSET`), unless existing map conventions require explicit `"none"`.

#### F) Documentation updates (L09)
- Update renderer UI docs to describe the Light tool behavior and cursor affordances.
- Update map-edit command docs to describe the new `map-edit/create-light` command.

#### G) Testing (L04/L08)
- Add unit tests for new/changed **public** methods and new command branching, including success/failure paths.

### Out of scope
- Editing additional light fields not currently modeled (e.g., `z`, `seed`, per-light enable flags).
- Drag-to-size (click+drag to set radius).
- Light duplication UX changes (Clone remains as-is).
- Any runtime/gameplay rendering changes (this is editor-only authoring support).

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - **L01 (Cross-platform parity):** Cursor feedback must be equivalent on macOS/Windows/Linux.
  - **L03 (Electron security):** Renderer must create lights via typed preload/IPC edits.
  - **L04 (Testing):** New/changed public methods must have unit tests covering conditional paths.
  - **L08 (Testability):** Prefer pure helpers for “can create light here?” decisions.
  - **L09 (Docs current):** Update subsystem docs for new behavior and command types.
- Must follow `.ushabti/style.md`:
  - Registry-driven tool definitions (avoid scattered conditionals).
  - Typed discriminated unions for new commands.
  - Avoid new dependencies.

## Phase decisions
- **Tool id / interaction mode:** Introduce a new tool id (e.g., `light`) and a corresponding interaction mode (e.g., `light-create`).
- **Tool ordering:** Place the Light tool at the **end of the toolbox**; ordering determines the assigned hotkey.
- **Default light fields on create:** Create a light with a complete, decoder-friendly shape:
  - `x`, `y` at click position
  - `radius` default (e.g., `8`)
  - `intensity` default (e.g., `1`)
  - `color` default `"#ffffff"`
  - no `flicker` key by default

Cursor decisions (cross-platform parity):
- macOS: match the requested visuals (X for invalid, green plus for valid) via platform-appropriate cursor selection.
- Windows/Linux: any **idiomatic** cursor treatment that clearly distinguishes “can create here” vs “cannot create here” is acceptable (e.g., `copy` vs `not-allowed`).

Flicker decisions (per map spec):
- `lights[].flicker` is optional.
- Valid values are `none | flame | malfunction`.
- Represent “none” by **omitting** the `flicker` key (use `MAP_EDIT_UNSET` when editing to clear it).

## Acceptance criteria

### Toolbox + hotkeys
- A Light tool button exists in the left toolbox with a light bulb icon and tooltip.
- The tool participates in the existing tool-hotkey system:
  - holding the primary modifier shows a badge,
  - pressing the assigned shortcut activates the Light tool.

### Cursor feedback
- With Light tool active:
  - When hovering outside any sector, the cursor indicates “invalid placement” (macOS shows an X; Windows/Linux show a standard blocked cursor).
  - When hovering inside a sector, the cursor indicates “valid placement” (macOS shows a green plus; Windows/Linux show a standard plus/copy cursor).

### Create behavior
- With a map loaded and Light tool active:
  - Clicking inside a sector creates exactly one new light at that point and selects it.
  - Clicking outside all sectors does not create a light.
  - Creation is performed via a new typed edit command (`map-edit/create-light`) routed through main.

### Light properties flicker
- Selecting a light shows a `flicker` control with options: none / flame / malfunction.
- Choosing a value commits via `map-edit/update-fields` and persists through Save + reopen.

### Quality gates
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.

## Risks / notes
- **Cursor visuals vary by platform.** Implement cursor selection via a small abstraction so macOS can meet the “X/green plus” request while Windows/Linux still get clear feedback.
- **Maps with incomplete light objects.** The editor’s decoder currently expects `radius` and `intensity|brightness`; creation must produce complete entries to avoid decode failures.
