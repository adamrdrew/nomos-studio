# Phase 0003 — Manual Verification Checklist

## Menu entrypoint

- macOS:
  - Launch the app.
  - In the menu bar, open the app menu and confirm there is a **Preferences…** item.
  - Confirm the **Cmd+,** accelerator opens Preferences.
  - Select **Preferences…** and confirm a Settings window opens showing the Settings form.

- Windows/Linux:
  - Launch the app.
  - Confirm there is a **Settings…** menu item (under Edit).
  - Confirm **Ctrl+,** opens Settings.

## Persistence

- Open Preferences/Settings.
- Set **Assets directory** to a non-empty path and click **Save**.
- Quit the app and relaunch.
- Re-open Preferences/Settings and confirm the Assets directory path persisted.

- Repeat for **Game executable**.

## Unknown-key preservation

- Quit the app.
- Locate the settings file under the app’s `userData` directory (it is `nomos-settings.json`).
  - macOS (typical): `~/Library/Application Support/Nomos Studio/nomos-settings.json`
  - Tip: in Finder, use **Go → Go to Folder…** and paste `~/Library/Application Support/` then open the `Nomos Studio` folder.
- Add a new key to the JSON object, for example:
  - `"futureSetting": { "enabled": true }`
- Save the file.
- Relaunch the app.
- Open Preferences/Settings and change **Assets directory** (or **Game executable**) and click **Save**.
- Re-open the settings file and confirm `futureSetting` is still present.

## No main-window UI changes

- Confirm there are no new Settings buttons/controls inside the main window content.
