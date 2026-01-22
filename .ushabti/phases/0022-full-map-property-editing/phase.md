# Phase 0022 — Full Map Property Editing (Map Properties Panel + Light Dragging)

## Intent
Expose editing for currently-unsupported **map-level** properties in the editor UI, by adding a dedicated **Map Properties** panel and wiring edits through the existing main-process transactional map-edit command system.

Also extend Move-mode dragging so **light emitters** can be moved/draggable when selected (matching entity dragging ergonomics).

This Phase exists now because map authors need to edit common top-level metadata (music, soundfont, map name, sky) without hand-editing JSON, and because lights are already selectable/visible but not yet movable.

## Scope

### In scope
- UI shell / panel layout:
  - Rename the Inspector’s existing “Properties” section to **Object Properties**.
  - Add a new **Map Properties** section within the Inspector, below **Object Properties**.
- Map Properties panel supports editing the following map top-level JSON fields:
  - `bgmusic` (dropdown)
  - `soundfont` (dropdown)
  - `name` (text input)
  - `sky` (dropdown)
- Asset-driven dropdowns:
  - `bgmusic` options are sourced from assets under `Sounds/MIDI/`.
  - `soundfont` options are sourced from assets under `Sounds/SoundFonts/`.
  - `sky` options are sourced from assets under `Images/Sky/`.
- Persistence / command system:
  - Map-level edits are applied via a **new main-owned atomic map edit command** (or an extension to existing update-fields targeting) that updates fields on the map root object.
  - Edits participate in undo/redo and stale-revision protection.
- Light dragging:
  - In Move mode, when a **light** is the active selection, dragging previews its motion and commits a single main-process edit on mouse-up.
  - Selection remains on the moved light after commit.
- Tests and docs updates required by laws.

### Out of scope
- Editing additional map top-level fields beyond the four listed.
- Adding new asset indexing metadata; we only filter from the existing `AssetIndex.entries` list.
- Renderer component testing beyond existing patterns (there are no renderer unit/component tests currently).
- “Browse…” filesystem dialogs from the Map Properties panel.
- Bulk apply / multi-map editing.

## Constraints
- **L01 (Cross-platform parity):** Asset path filtering must use the existing POSIX-normalized asset index entries and be OS-agnostic.
- **L03 (Electron security):** Renderer must not touch filesystem APIs; it must use only snapshot state and existing preload IPC.
- **L04 (Testing):** Any changed/added public methods (notably in `MapCommandEngine`, IPC contract types) must have unit tests covering conditional paths.
- **L08 (Design for testability):** Map root updates and light move logic in main must be deterministic and unit-testable.
- **L09 (Docs):** Update subsystem docs under `docs/` if UI behavior or map-edit command shapes change.

## Assumptions (explicit)
- **Map JSON root is an object** (record) for all supported maps; updating top-level keys is valid.
- The engine expects **file names (basenames)** for these fields (not relative paths). The UI dropdowns therefore:
  - display basenames (e.g., `PORTAL-JUMP.MID`, `purple.png`)
  - store basenames into the map fields.
- The asset folders are:
  - `Assets/Sounds/MIDI/`
  - `Assets/Sounds/SoundFonts/`
  - `Assets/Images/Sky/`
  Renderer filtering is performed against `AssetIndex.entries` which are relative to the configured assets root, so expected entry prefixes are:
  - `Sounds/MIDI/`
  - `Sounds/SoundFonts/`
  - `Images/Sky/`

## Acceptance criteria

### UI / layout
- The existing Inspector “Properties” section is renamed to **Object Properties**.
- The Inspector contains a **Map Properties** section below **Object Properties**.

### Map Properties editing
- When a map is open, Map Properties displays controls for:
  - `bgmusic` (dropdown)
  - `soundfont` (dropdown)
  - `name` (text input)
  - `sky` (dropdown)
- Changing a value commits a map edit via `window.nomos.map.edit({ baseRevision, command })` and updates the open map state.
- Undo/redo returns the map fields to prior values.
- Saving writes the updated map JSON to disk (existing Save behavior).

### Asset dropdown behavior
- `bgmusic` dropdown options are derived from `AssetIndex.entries` filtered to `Sounds/MIDI/` and presented as basenames.
- `soundfont` dropdown options are derived from `AssetIndex.entries` filtered to `Sounds/SoundFonts/` and presented as basenames.
- `sky` dropdown options are derived from `AssetIndex.entries` filtered to `Images/Sky/` and presented as basenames.
- When assets are not configured or the index is missing, the panel shows a clear empty-state message and disables dropdowns.

### Light dragging
- In Move mode, selecting a light and dragging it moves the light marker visually during drag and commits on mouse-up.
- The committed edit updates the light’s position in map JSON and survives a refresh/reopen.
- Undo reverts the light move.

### Quality gates
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- Main-process unit tests cover the new command(s) and key failure branches (invalid root JSON, invalid coords, missing light target, etc.).

## Risks / notes
- **Basename vs path:** If the game/validator expects full relative paths rather than basenames, the UI must store relative paths instead; validate expectations early.
- **Asset folder naming drift:** The requested folders include both `Sound/...` and `Sounds/...`; confirm actual asset tree naming to avoid an empty dropdown UX.
- Adding new map-edit command variants requires coordinated changes across shared IPC types, preload typing, main engine, and docs.
