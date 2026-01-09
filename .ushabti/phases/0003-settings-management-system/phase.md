# Phase 0003 — Settings Management System

## Intent
Harden and formalize a persistent, extensible settings system and a platform-idiomatic Settings/Preferences entrypoint.

This Phase exists now to ensure the app has a durable foundation for app-level configuration (currently: Assets folder location and Nomos Engine executable location) that can be safely extended over time without breaking users’ existing installations or discarding unknown/future settings.

## Scope

### In scope
- **Settings persistence designed for extension**
  - Define an explicit on-disk settings file format that supports:
    - schema versioning
    - backward-compatible loading of existing settings files
    - forward-compatible behavior (unknown fields are preserved, not discarded)
  - Keep domain-layer settings types free of Electron and filesystem/process imports.

- **Settings management UI entrypoint (platform-idiomatic)**
  - Provide a standard, idiomatic way to open the Settings UI from the OS menu bar / application menu on all platforms.
  - Do not add any Settings controls/buttons inside the main window UI (the main window UI is not implemented yet).
  - The Settings UI manages exactly the current app-level settings:
    - Assets directory path
    - Nomos Engine executable path

- **Security and boundaries**
  - Settings read/write and any OS dialogs remain privileged operations mediated by main/preload boundaries.

- **Testing (L04/L08)**
  - Add/extend unit tests for any new/changed public methods introduced by this Phase, covering all conditional paths.

### Out of scope
- Adding any new settings beyond:
  - Assets directory path
  - Nomos Engine executable path
- Additional settings pages/tabs, advanced validation UX, or new workflows.
- Map operations, asset indexing, or any editor tooling.

## Constraints
- Must comply with `.ushabti/laws.md`, especially:
  - L01 (macOS/Windows/Linux parity): settings format, menu entrypoints, and shortcut behavior must be supported across platforms.
  - L02 (offline local operation): settings management must not require network.
  - L03 (Electron security): renderer has no Node.js access; privileged settings persistence stays behind preload IPC.
  - L04 (tests): all public methods introduced/changed must be unit-tested across conditional paths.
  - L05 (resource safety): no temp-file leaks during settings writes.
  - L06 (non-destructive by default): settings writes must be safe/atomic and must not discard unrelated user data in the settings file.
  - L08 (design for testability): filesystem, Electron primitives, and time must remain behind injectable adapters.
- Must follow `.ushabti/style.md`:
  - preserve domain/application/infrastructure boundaries
  - avoid unnecessary new dependencies
  - keep public API surface minimal

## Acceptance criteria
- **Persistent settings**
  - The two current settings (Assets directory path, Nomos Engine executable path) persist across app restart.

- **Extensible settings file format**
  - The on-disk settings file includes an explicit schema version.
  - Loading supports existing installs:
    - If a settings file exists in an older/legacy shape, the app loads it without user action.
  - Updating known settings does not discard unknown settings fields:
    - If the settings file contains additional keys not known to the current app version, those keys remain present after updating Assets/Engine paths.

- **Platform-idiomatic Settings UI entrypoint**
  - macOS:
    - A menu item exists in the application menu (menu bar) to open the Settings UI.
    - It uses the conventional accelerator (Cmd+,) and is labeled in a platform-idiomatic way ("Preferences…").
    - Prefer Electron’s standard role for this entrypoint when appropriate (so the item appears where macOS users expect it).
  - Windows/Linux:
    - A menu item exists (e.g., under Edit) to open the Settings UI, using the conventional accelerator (Ctrl+,).
    - Label should be platform-idiomatic (assumption: "Settings…").
  - Selecting the menu item opens the existing Settings UI surface (dialog or window).

- **No premature main-window UI**
  - No new buttons, panels, or controls are added to the main window content to access Settings; the menu entrypoint is the only required UX for this Phase.

- **Tests**
  - New/changed public APIs related to settings serialization/versioning/migration and menu entrypoint behavior have unit tests covering success/failure/branch paths.

## Risks / notes
- **Assumption (UI surface):** “Settings window” may be implemented as a renderer modal dialog if it behaves like a settings surface and is reachable via the platform-idiomatic menu entrypoint.
- **Assumption (naming):** macOS uses “Preferences…” while Windows/Linux use “Settings…”. If the product wants consistent naming across platforms, update acceptance criteria accordingly.
- **Forward-compatibility tension:** preserving unknown fields requires care so saves remain deterministic and do not widen the public API surface unnecessarily.
