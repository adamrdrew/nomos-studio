import { decodeSettingsFile, encodeSettingsFile, SETTINGS_FILE_VERSION } from './settingsCodec';

const defaultSettings = {
  assetsDirPath: null,
  gameExecutablePath: null,
  defaultSky: null,
  defaultSoundfont: null,
  defaultBgmusic: null,
  defaultWallTex: null,
  defaultFloorTex: null,
  defaultCeilTex: null
} as const;

describe('settingsCodec', () => {
  it('decodes legacy/unversioned files (no version field)', () => {
    const raw = JSON.stringify({ assetsDirPath: '/assets', gameExecutablePath: '/nomos-engine' });

    const result = decodeSettingsFile(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBeNull();
      expect(result.value.settings).toEqual({
        assetsDirPath: '/assets',
        gameExecutablePath: '/nomos-engine',
        defaultSky: null,
        defaultSoundfont: null,
        defaultBgmusic: null,
        defaultWallTex: null,
        defaultFloorTex: null,
        defaultCeilTex: null
      });
      expect(result.value.unknownFields).toEqual({});
    }
  });

  it('decodes versioned files', () => {
    const raw = JSON.stringify({ version: 1, assetsDirPath: '/assets', gameExecutablePath: null });

    const result = decodeSettingsFile(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe(1);
      expect(result.value.settings.assetsDirPath).toBe('/assets');
      expect(result.value.settings.gameExecutablePath).toBeNull();
    }
  });

  it('returns parse-failed when JSON is invalid', () => {
    const result = decodeSettingsFile('{nope');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/parse-failed');
    }
  });

  it('returns parse-failed when JSON is not an object', () => {
    const result = decodeSettingsFile('"not-an-object"');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/parse-failed');
      expect(result.error.message).toBe('Settings file is not a JSON object');
    }
  });

  it('encodes settings while preserving unknown keys', () => {
    const raw = JSON.stringify({
      version: 1,
      assetsDirPath: '/old-assets',
      gameExecutablePath: '/old-engine',
      futureSetting: { enabled: true },
      extra: 123
    });

    const decoded = decodeSettingsFile(raw);
    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      throw new Error('Expected ok');
    }

    const encoded = encodeSettingsFile({
      ...decoded.value,
      settings: {
        assetsDirPath: '/new-assets',
        gameExecutablePath: null,
        defaultSky: null,
        defaultSoundfont: null,
        defaultBgmusic: null,
        defaultWallTex: null,
        defaultFloorTex: null,
        defaultCeilTex: null
      }
    });

    expect(encoded['futureSetting']).toEqual({ enabled: true });
    expect(encoded['extra']).toBe(123);
    expect(encoded['assetsDirPath']).toBe('/new-assets');
    expect(encoded['gameExecutablePath']).toBeNull();
    expect(encoded['version']).toBe(1);
  });

  it('writes an explicit version when none was present', () => {
    const decoded = decodeSettingsFile(JSON.stringify({ assetsDirPath: null, gameExecutablePath: null }));
    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      throw new Error('Expected ok');
    }

    expect(decoded.value.settings).toEqual(defaultSettings);

    const encoded = encodeSettingsFile(decoded.value);
    expect(encoded['version']).toBe(SETTINGS_FILE_VERSION);
  });
});
