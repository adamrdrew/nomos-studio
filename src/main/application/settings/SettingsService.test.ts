import { SettingsService, type SettingsRepository } from './SettingsService';
import type { EditorSettings } from '../../../shared/domain/models';

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
      loadSettings: async () => okSettings({ assetsDirPath: null, gameExecutablePath: null }),
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
      loadSettings: async () => okSettings({ assetsDirPath: null, gameExecutablePath: null }),
      saveSettings: async (settings) => {
        saved = settings;
        return { ok: true as const, value: undefined };
      }
    };

    const service = new SettingsService(repository);

    const result = await service.updateSettings({ assetsDirPath: '/assets' });

    expect(result.ok).toBe(true);
    expect(saved).toEqual({ assetsDirPath: '/assets', gameExecutablePath: null });
  });

  it('updateSettings returns error when save fails', async () => {
    const repository: SettingsRepository = {
      loadSettings: async () => okSettings({ assetsDirPath: null, gameExecutablePath: null }),
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
