import { SettingsService, type SettingsRepository } from './SettingsService';
import type { EditorSettings } from '../../../shared/domain/models';

const defaultSettings: EditorSettings = {
  assetsDirPath: null,
  gameExecutablePath: null,
  defaultSky: null,
  defaultSoundfont: null,
  defaultBgmusic: null,
  defaultWallTex: null,
  defaultFloorTex: null,
  defaultCeilTex: null
};

function okSettings(settings: EditorSettings) {
  return { ok: true as const, value: settings };
}

function errSettings(code: string) {
  return {
    ok: false as const,
    error: {
      kind: 'settings-error' as const,
      code: code as 'settings/read-failed',
      message: 'boom'
    }
  };
}

describe('SettingsService', () => {
  it('getSettings forwards repository load', async () => {
    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(defaultSettings),
      saveSettings: async () => ({ ok: true as const, value: undefined })
    };

    const service = new SettingsService(repository);

    const result = await service.getSettings();

    expect(result.ok).toBe(true);
  });

  it('updateSettings returns error when load fails', async () => {
    const repository: SettingsRepository = {
      loadSettings: async () => errSettings('settings/read-failed'),
      saveSettings: async () => ({ ok: true as const, value: undefined })
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ assetsDirPath: '/assets' });

    expect(result.ok).toBe(false);
  });

  it('updateSettings merges partial updates and persists them', async () => {
    let saved: EditorSettings | null = null;

    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(defaultSettings),
      saveSettings: async (settings) => {
        saved = settings;
        return { ok: true as const, value: undefined };
      }
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ assetsDirPath: '/assets' });

    expect(result.ok).toBe(true);
    expect(saved).toEqual({ ...defaultSettings, assetsDirPath: '/assets' });
  });

  it('updateSettings preserves default-asset fields when updates omit them', async () => {
    let saved: EditorSettings | null = null;

    const current: EditorSettings = {
      ...defaultSettings,
      defaultSky: 'day.png',
      defaultSoundfont: 'soundfont.sf2',
      defaultBgmusic: 'track.mid',
      defaultWallTex: 'wall.png',
      defaultFloorTex: 'floor.png',
      defaultCeilTex: 'ceil.png'
    };

    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(current),
      saveSettings: async (settings) => {
        saved = settings;
        return { ok: true as const, value: undefined };
      }
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ assetsDirPath: '/assets' });

    expect(result.ok).toBe(true);
    expect(saved).toEqual({ ...current, assetsDirPath: '/assets' });
  });

  it('updateSettings updates default-asset fields when provided', async () => {
    let saved: EditorSettings | null = null;

    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(defaultSettings),
      saveSettings: async (settings) => {
        saved = settings;
        return { ok: true as const, value: undefined };
      }
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({
      defaultSky: 'day.png',
      defaultSoundfont: 'soundfont.sf2',
      defaultBgmusic: 'track.mid',
      defaultWallTex: 'wall.png',
      defaultFloorTex: 'floor.png',
      defaultCeilTex: 'ceil.png'
    });

    expect(result.ok).toBe(true);
    expect(saved).toEqual({
      ...defaultSettings,
      defaultSky: 'day.png',
      defaultSoundfont: 'soundfont.sf2',
      defaultBgmusic: 'track.mid',
      defaultWallTex: 'wall.png',
      defaultFloorTex: 'floor.png',
      defaultCeilTex: 'ceil.png'
    });
  });

  it('updateSettings clears a default-asset field when null is provided', async () => {
    let saved: EditorSettings | null = null;

    const current: EditorSettings = {
      ...defaultSettings,
      defaultSky: 'day.png'
    };

    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(current),
      saveSettings: async (settings) => {
        saved = settings;
        return { ok: true as const, value: undefined };
      }
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ defaultSky: null });

    expect(result.ok).toBe(true);
    expect(saved).toEqual({ ...current, defaultSky: null });
  });

  it('updateSettings returns error when save fails', async () => {
    const repository: SettingsRepository = {
      loadSettings: async () => okSettings(defaultSettings),
      saveSettings: async () =>
        ({
          ok: false as const,
          error: {
            kind: 'settings-error' as const,
            code: 'settings/write-failed' as const,
            message: 'nope'
          }
        })
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ assetsDirPath: '/assets' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/write-failed');
    }
  });
});
