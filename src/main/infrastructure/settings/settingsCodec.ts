import type { EditorSettings } from '../../../shared/domain/models';
import type { Result, SettingsError } from '../../../shared/domain/results';

export const SETTINGS_FILE_VERSION = 1;

export type DecodedSettingsFile = Readonly<{
  version: number | null;
  settings: EditorSettings;
  unknownFields: Readonly<Record<string, unknown>>;
}>;

function toSettingsError(code: SettingsError['code'], message: string): SettingsError {
  return {
    kind: 'settings-error',
    code,
    message
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodePathField(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function decodeVersionField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function effectiveVersion(version: number | null): number {
  return version === null ? SETTINGS_FILE_VERSION : version;
}

/**
 * Settings file format
 *
 * The app persists settings to a JSON object with:
 * - `version: number` (currently written as 1)
 * - known keys: `assetsDirPath`, `gameExecutablePath`, and default asset fields
 * - any additional keys are preserved on save for forward compatibility
 *
 * Legacy/unversioned files are supported: if `version` is missing (or not a number), the file is treated as legacy.
 */
export function decodeSettingsFile(rawText: string): Result<DecodedSettingsFile, SettingsError> {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!isJsonRecord(parsed)) {
      return {
        ok: false,
        error: toSettingsError('settings/parse-failed', 'Settings file is not a JSON object')
      };
    }

    const version = decodeVersionField(parsed['version']);

    const settings: EditorSettings = {
      assetsDirPath: decodePathField(parsed['assetsDirPath']),
      gameExecutablePath: decodePathField(parsed['gameExecutablePath']),
      defaultSky: decodePathField(parsed['defaultSky']),
      defaultSoundfont: decodePathField(parsed['defaultSoundfont']),
      defaultBgmusic: decodePathField(parsed['defaultBgmusic']),
      defaultWallTex: decodePathField(parsed['defaultWallTex']),
      defaultFloorTex: decodePathField(parsed['defaultFloorTex']),
      defaultCeilTex: decodePathField(parsed['defaultCeilTex'])
    };

    const unknownFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key === 'version' ||
        key === 'assetsDirPath' ||
        key === 'gameExecutablePath' ||
        key === 'defaultSky' ||
        key === 'defaultSoundfont' ||
        key === 'defaultBgmusic' ||
        key === 'defaultWallTex' ||
        key === 'defaultFloorTex' ||
        key === 'defaultCeilTex'
      ) {
        continue;
      }
      unknownFields[key] = value;
    }

    return {
      ok: true,
      value: {
        version,
        settings,
        unknownFields
      }
    };
  } catch (_error: unknown) {
    return {
      ok: false,
      error: toSettingsError('settings/parse-failed', 'Settings file contains invalid JSON')
    };
  }
}

export function encodeSettingsFile(decoded: DecodedSettingsFile): Record<string, unknown> {
  return {
    ...decoded.unknownFields,
    version: effectiveVersion(decoded.version),
    assetsDirPath: decoded.settings.assetsDirPath,
    gameExecutablePath: decoded.settings.gameExecutablePath,
    defaultSky: decoded.settings.defaultSky,
    defaultSoundfont: decoded.settings.defaultSoundfont,
    defaultBgmusic: decoded.settings.defaultBgmusic,
    defaultWallTex: decoded.settings.defaultWallTex,
    defaultFloorTex: decoded.settings.defaultFloorTex,
    defaultCeilTex: decoded.settings.defaultCeilTex
  };
}
