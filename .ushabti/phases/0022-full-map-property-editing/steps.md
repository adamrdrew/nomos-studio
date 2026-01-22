# Phase 0022 — Steps

## S001 — Inspect current Inspector/Properties UI and DockView layout
- **Intent:** Ensure the new Map Properties panel fits existing shell patterns and naming.
- **Work:**
  - Locate where the right-side DockView panels are defined (likely `EditorShell.tsx`).
  - Locate the current “Properties” section implementation (object inspector) and confirm rename surface.
  - Identify how the renderer reads the current open map’s decoded view model vs raw JSON needs for display.
- **Done when:** A short note captures: (1) which component owns the Properties title, and (2) the intended place to add a new DockView panel.

## S002 — Confirm map field storage expectations (basename vs relative path)
- **Intent:** Prevent shipping a UI that writes values the validator/runtime won’t accept.
- **Work:**
  - Check existing maps under `docs/repro-maps/` or sample maps for `bgmusic`, `soundfont`, `sky`, `name` value shapes.
  - Confirm how renderer resolves `sky` (docs say `Images/Sky/<map.sky>`).
  - Decide and document whether to store basenames or relative paths for each field.
- **Done when:** A concrete decision is documented in Phase notes and reflected in acceptance criteria/test fixtures.

> Note (recorded): The engine expects **basenames** for `bgmusic`, `soundfont`, and `sky`.

## S003 — Define the map-level edit command shape
- **Intent:** Make map root editing explicit, reviewable, and testable.
- **Work:** Choose one approach and document the rationale:
  - **Option A:** Extend `MapEditTargetRef` to include `{ kind: 'map' }` and reuse `map-edit/update-fields`.
  - **Option B:** Introduce a new atomic command `map-edit/update-map-fields` with `set: Record<string, primitive>`.

  In either case, define:
  - validation rules (keys non-empty; values are JSON primitives; numbers finite)
  - semantics (set keys on root object; selection effect keep)
  - failure codes for invalid root JSON (non-object) and invalid inputs.
- **Done when:** The chosen command is specified and ready to implement in shared IPC + main engine.

## S004 — Update shared IPC contract and preload typing for the new command
- **Intent:** Keep renderer↔main contract typed and centralized.
- **Work:**
  - Update `src/shared/ipc/nomosIpc.ts` command union(s) and any related request/response types.
  - Update `src/preload/nomos.d.ts` if needed (likely no change beyond command typing if `map.edit` stays the same).
  - Ensure no widening of preload surface (reuse `window.nomos.map.edit`).
- **Done when:** Typecheck passes and the command is available to both main and renderer.

## S005 — Implement map-root field update in `MapCommandEngine`
- **Intent:** Apply map-level field edits deterministically and transactionally.
- **Work:**
  - Implement the new command variant (or extended target handling) in `MapCommandEngine.applyAtomic`.
  - Ensure edits are applied to a cloned working JSON and only committed on success.
  - Ensure selection effect is `map-edit/selection/keep`.
- **Done when:** Unit tests (S006) pass for the new behavior.

## S006 — Add/extend main unit tests for map-root updates (L04)
- **Intent:** Lock in behavior and cover conditional paths.
- **Work:** Add tests covering:
  - successful updates of each field (`bgmusic`, `soundfont`, `name`, `sky`)
  - invalid root JSON (non-object) returns a typed error
  - rejecting non-primitive values and non-finite numbers
  - idempotent behavior when setting same value
  - undo/redo integration via existing history tests if applicable
- **Done when:** Tests fail on the old code, pass on the new code, and cover all new branches.

## S007 — Add the new right-side DockView panel: “Map Properties”
- **Intent:** Provide a dedicated UI surface for map-level editing.
- **Work:**
  - Add a non-closable core panel named “Map Properties” on the right alongside existing core panels.
  - Implement a `MapPropertiesPanel` (or equivalent) component.
- **Done when:** The panel appears in the editor UI, empty-state renders correctly when no map is open.

> Note: This intermediate design was later **superseded** by S017, which moves Map Properties into the Inspector as a section and removes the separate DockView panel.

## S008 — Rename “Properties” to “Object Properties”
- **Intent:** Disambiguate object-level vs map-level editing.
- **Work:**
  - Rename the existing inspector section title and any related UI labels.
  - Ensure no functionality regression in object property editing.
- **Done when:** The UI shows “Object Properties” where it previously showed “Properties”.

## S009 — Implement asset-driven dropdowns in Map Properties
- **Intent:** Ensure users can choose from valid assets without manual typing.
- **Work:**
  - Read `assetIndex.entries` from the renderer snapshot store.
  - Filter entries by prefix (`Sounds/MIDI/`, `Sounds/SoundFonts/`, `Images/Sky/`).
  - Present options sorted and displayed as basenames (or relative-to-folder paths if Phase decision differs).
  - Wire dropdown selection to commit a map edit command for the corresponding field.
  - Implement `name` as a text input committing via edit command.
  - Handle missing assets index/settings with a clear disabled-state.
- **Done when:** Changing any control commits an edit and updates state; empty states behave well.

## S010 — Extend Move mode to support dragging lights
- **Intent:** Match entity dragging ergonomics for lights.
- **Work:**
  - Update Move tool logic so if the active selection is `{ kind: 'light', index }`, dragging produces a local preview and commits a single map edit on mouse-up.
  - Add a new atomic command (recommended: `map-edit/move-light`) or reuse update-fields to set `x`/`y`.
  - Ensure selection stays on the moved light.
- **Done when:** Light dragging works in-app and produces an undoable command.

## S011 — Add/extend main unit tests for light movement (L04)
- **Intent:** Make light movement robust and deterministic.
- **Work:** Add tests covering:
  - successful light move updates `x`/`y`
  - invalid target index returns typed error
  - invalid coordinates (non-finite) rejected
  - selection effect is keep
  - undo/redo returns light to prior coords
- **Done when:** Tests cover all new branches and pass.

## S012 — Update docs (L09)
- **Intent:** Keep subsystem documentation accurate.
- **Work:**
  - Update `docs/renderer-ui-system.md` to document:
    - Map Properties panel
    - Object Properties rename
    - light dragging support
  - Update `docs/map-edit-command-system.md` to document new/extended command(s) for map root updates and light moves.
  - Update `docs/maps-system.md` if the “Property editing” section needs adjustment.
- **Done when:** Docs describe the new behavior/commands and no longer imply the old limitations.

## S013 — Verification and quality gates
- **Intent:** Ship the Phase green.
- **Work:**
  - Run `npm test`, `npm run typecheck`, `npm run lint`.

- **Done when:** All quality gates pass.

## S015 — Fix Phase doc asset prefix typo (Sound vs Sounds)
- **Intent:** Keep Phase documentation internally consistent so it can be reviewed/audited.
- **Work:**
  - In `phase.md`, correct the in-scope bullet that says `Sound/MIDI/` to `Sounds/MIDI/` to match the explicit assumptions and renderer implementation.
- **Done when:** `phase.md` consistently uses `Sounds/MIDI/`, `Sounds/SoundFonts/`, and `Images/Sky/`.

## S016 — Restore/ensure Object Properties panel visibility
- **Intent:** Prevent a UI regression where the Inspector/Object Properties editor is not discoverable after adding Map Properties.
- **Work:**
  - Reproduce: confirm whether the Inspector DockView panel is missing, collapsed to near-zero height, or otherwise obscured by the new Map Properties panel.
  - Implement a fix consistent with DockView patterns (e.g., assign a reasonable `initialHeight` to `map-properties` and/or enforce minimum split sizes so both panels are visible by default).
  - Verify that selecting a wall/entity/etc shows editable fields in the Inspector’s Object Properties section.
- **Done when:** Inspector (Object Properties) is visible by default and works alongside Map Properties.

## S017 — Simplify UI: make Map Properties a section within Inspector (not a separate DockView panel)
- **Intent:** Match the clarified requirement: “add a new panel under the object panel”, without introducing a second right-side DockView panel that can obscure/mask the Inspector.
- **Work:**
  - Remove the `map-properties` DockView panel addition from `EditorShell.tsx`.
  - Integrate Map Properties UI into `InspectorDockPanel.tsx` as a new `CollapsibleSection` below **Object Properties**.
  - Keep the Map Properties UI behavior the same (asset-backed dropdowns + name textbox; commits via map-edit commands).
  - Ensure the Inspector remains the only right-side “Inspector” panel and object editing is visible.
- **Done when:** Inspector shows both sections (Object Properties + Map Properties) and object property editing is visible again.

## S018 — Update docs for simplified Inspector layout
- **Intent:** Keep docs accurate after moving Map Properties into the Inspector (L09).
- **Work:**
  - Update `docs/renderer-ui-system.md` to describe Map Properties as a section within Inspector (not a separate DockView panel).
  - Update any other docs that refer to a DockView “Map Properties panel” if they become misleading.
- **Done when:** Docs match the implemented layout and behavior.

## S014 — Manual verification
- **Intent:** Validate end-to-end UX and IPC behavior in the running app.
- **Work:**
  - Object Properties is visible and can edit walls/entities/etc.
  - Map Properties edits persist, undo/redo works.
  - Dropdowns populate from assets when configured.
  - Light dragging works and is undoable.
- **Done when:** Manual checks meet acceptance criteria.

## S019 — Reconcile Phase artifacts after Inspector layout simplification
- **Intent:** Ensure the Phase record matches the final implemented design (Map Properties is a section within Inspector, not a separate DockView panel).
- **Work:**
  - Update Phase steps/progress notes so the obsolete “Map Properties DockView panel” step (S007) is clearly marked as superseded by S017 (or otherwise reconciled) and does not read as required end-state behavior.
  - Update `review.md` Summary/Decision to reflect the current state (manual verification recorded complete; doc typo fixed; gates green) once the step reconciliation is done.
- **Done when:** `steps.md`, `progress.yaml`, and `review.md` are consistent with the final UI/layout described in `phase.md` and the implemented renderer layout.
