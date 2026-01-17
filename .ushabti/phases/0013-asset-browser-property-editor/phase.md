# Phase 0013 — Asset Browser + Property Editor Improvements

## Intent
Make the Inspector’s **Asset Browser** and **Properties** sections feel native to the app’s dark UI and enable editing selected object properties through a GUI (no raw JSON), with changes applied via the main-process transactional map edit system so they persist on save and support undo/redo.

This Phase exists now because the current Inspector panels render as white-on-white web content inside a dark desktop editor, and because raw JSON display is not an ergonomic editing experience.

## Scope

### In scope

#### A) Dark-mode theming for Inspector panels
- Update **Asset Browser** and **Properties** sections to use a dark-mode appearance consistent with the editor:
  - Replace white backgrounds with a mid-gray surface (not as dark as the outer inspector background).
  - Use very light gray/white text and icons.

#### B) Asset Browser icon color-coding
- Color-code asset entry icons (bright enough for dark backgrounds) by entry type:
  - Folder: **Blue**
  - PNG: **Red**
  - MIDI: **Green**
  - Soundfont: **Yellow**
  - JSON: **Purple**
  - WAV: **Orange**
  - TTF / Font: **Pink**
  - Anything else / fallback: **Teal**
- Use existing design primitives already in the codebase (Blueprint `Colors.*` constants) rather than introducing a new palette.

#### C) Replace raw JSON Properties view with an editable GUI
- Replace the raw JSON `<pre>` display with a structured editor for the currently selected map object.
- Always hide the `index` property (internal identity).
- Render appropriate controls:
  - **string** => text input
  - **number** => text input (free-form), with parsing + validation; committed value must be stored as a real number in map JSON
  - **RGB color** => three numeric inputs (0–255)
  - **degrees** => numeric input (0–360)
  - **textures** => dropdown listing textures under `Assets/Images/Textures`
  - **entity defname** => dropdown sourced from `Assets/Entities/entities_manifest.json` (preferred)

#### D) Persistence + edit semantics
- Property edits are applied via **typed IPC** and the existing **main-process map edit command system**:
  - Edits must mark the document dirty.
  - Edits must be undoable/redoable.
  - Saving the map must persist the edited properties.
  - Stale revision must be rejected atomically (`map-edit/stale-revision`).

#### E) Tests + docs
- Add/update unit tests for new/changed public APIs and conditional branches (L04).
- Update subsystem docs that become inaccurate (L09), at minimum:
  - `docs/renderer-ui-system.md`
  - `docs/map-edit-command-system.md`
  - `docs/maps-system.md` (if it enumerates supported edit commands)

### Out of scope
- Creating a generalized schema-driven editor for nested objects/arrays.
- Adding new preload APIs or widening renderer privileges (L03).
- Adding new dependencies.
- Asset indexing changes (metadata, mtime/size, MIME detection) beyond what is needed for the UI.

## Constraints
- **L03 (Electron security):** renderer must not traverse filesystem; it can only use `window.nomos.*` APIs (asset index snapshot, `readFileBytes`, and map edit IPC).
- **L04 (Testing):** any change to shared IPC unions or main map-edit services/engine must be unit-tested across success/failure/edge branches.
- **L09 (Docs):** update the relevant docs in the same change.
- Style guide:
  - Keep boundaries explicit (renderer UI stays in renderer; map mutation stays in main).
  - Prefer existing primitives (Blueprint) and avoid hard-coded, arbitrary colors.

## Assumptions (must be confirmed or adjusted during implementation)
- **Asset type detection** is by file extension (case-insensitive):
  - PNG: `.png`
  - MIDI: `.mid` or `.midi`
  - Soundfont: `.sf2` (interpretation of “Soundfound”)
  - JSON: `.json`
  - WAV: `.wav`
  - Font: `.ttf` (and optionally `.otf` if present)
- **Texture list path** is interpreted as asset index entries under `Images/Textures/` (relative paths are POSIX). If the repo uses `Assets/Images/Textures/` literally as a relative prefix, adjust accordingly.
- **Editable selection kinds:** Properties editor applies to the selection kinds currently produced by hit-testing and shown in Inspector today (at least: `light`, `particle`, `entity`, `door`). If additional kinds are selectable in the UI (walls/sectors), they can remain read-only or be deferred unless explicitly required.

## Acceptance criteria

### Inspector theming
- Asset Browser section uses dark-mode styling (no white background blocks), with readable light text.
- Properties section uses dark-mode styling consistent with Asset Browser.

### Asset Browser icon colors
- Icons are color-coded per the mapping above and remain readable on the dark surface.
- Folders and common file types (png/midi/sf2/json/wav/ttf) match their specified colors.

### Properties editor UX
- Raw JSON `<pre>` is no longer used for the Properties viewer.
- `index` is never displayed.
- Editing behavior:
  - Changing a string updates the map JSON with a string.
  - Changing a number commits a real number (not a string) into map JSON.
  - RGB inputs clamp/validate to 0–255.
  - Degrees input clamps/validates to 0–360.
  - Texture dropdown lists entries under the texture folder and commits the selected texture reference.
  - Entity defname dropdown loads from the entities manifest and commits the chosen defname.

### Persistence + edit semantics
- A property edit marks the document dirty.
- Undo/redo works for property edits.
- Save + reopen preserves edited properties.
- Stale revision rejects atomically and the renderer refreshes state (no partial updates).

### Verification
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Docs updates are present and accurate.

## Risks / notes
- Property editing requires a new main-process edit command. Keep it narrow and validate inputs to preserve determinism and safety.
- Entities manifest parsing must fail gracefully (missing file/invalid JSON) without breaking the Inspector.
- UI validation should prevent committing NaN/non-finite numbers into map JSON.
