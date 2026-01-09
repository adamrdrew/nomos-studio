# Manual verification checklist — Phase 0002

## Settings
- Launch the app.
- Open **Settings…** from the menu.
- Click **Browse…** for **Assets directory** and pick a directory.
- Click **Browse…** for **Game executable** and pick the engine/game executable.
- Click **Save**.
- Quit the app and relaunch.
- Re-open **Settings…** and confirm both paths persisted.

## Assets index refresh
- With an Assets directory configured, choose **File → Refresh Assets Index**.
- Confirm a success message appears with the indexed file count.
- Set Assets directory to an invalid/unreadable path and choose **Refresh Assets Index**.
- Confirm a failure message appears.

## Open map (gating)
- Clear one or both settings (Assets directory path and/or Game executable path).
- Choose **File → Open Map…**.
- Confirm a user-friendly error is shown and no map is loaded.

## Open map (validation-first)
- Configure both settings again.
- Choose **File → Open Map…** and select a known-valid `.json` map.
- Confirm no error is shown (map loads into the in-memory document model).

## Invalid map error display
- Choose **File → Open Map…** and select a known-invalid `.json` map.
- Confirm a human-readable error is shown.
- If the validator outputs a JSON error report, confirm the report is displayed (pretty-printed); otherwise confirm raw output is shown.

## Save
- With no map loaded, choose **File → Save**.
- Confirm a friendly error is shown.
- With a map loaded, choose **File → Save**.
- Confirm no error is shown and the original file updates on disk.
