# Settings file format

This app persists app-level settings to a JSON file under Electron `app.getPath('userData')`.

## Versioned format (current)

The settings file is a single JSON object with a schema version and a small set of known keys:

```json
{
  "version": 1,
  "assetsDirPath": null,
  "gameExecutablePath": null,
  "defaultSky": null,
  "defaultSoundfont": null,
  "defaultBgmusic": null,
  "defaultWallTex": null,
  "defaultFloorTex": null,
  "defaultCeilTex": null
}
```

- `version` is a number. The app currently writes `1`.
- `assetsDirPath` is `string | null`.
- `gameExecutablePath` is `string | null`.
- `defaultSky` is `string | null` (basename under `Images/Sky/`).
- `defaultSoundfont` is `string | null` (basename under `Sounds/SoundFonts/`).
- `defaultBgmusic` is `string | null` (basename under `Sounds/MIDI/`).
- `defaultWallTex` is `string | null` (basename under `Images/Textures/`).
- `defaultFloorTex` is `string | null` (basename under `Images/Textures/`).
- `defaultCeilTex` is `string | null` (basename under `Images/Textures/`).

## Forward-compatible behavior (unknown keys)

The settings system is designed to be extensible:

- If the settings file contains additional keys that this app version does not recognize, those keys must be preserved when saving updates to known fields.

## Backward-compatible behavior (legacy/unversioned)

Older installs may have a legacy settings file with the same known keys but without a `version` field.

- The app must load these legacy files without user action.
- When saving, the app may write the versioned format.
