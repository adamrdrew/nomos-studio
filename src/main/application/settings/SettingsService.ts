import type { EditorSettings } from '../../../shared/domain/models';
import type { Result, SettingsError } from '../../../shared/domain/results';

export type SettingsRepository = Readonly<{
  loadSettings: () => Promise<Result<EditorSettings, SettingsError>>;
  saveSettings: (settings: EditorSettings) => Promise<Result<void, SettingsError>>;
}>;

export class SettingsService {
  private readonly repository: SettingsRepository;

  public constructor(repository: SettingsRepository) {
    this.repository = repository;
  }

  public async getSettings(): Promise<Result<EditorSettings, SettingsError>> {
    return this.repository.loadSettings();
  }

  public async updateSettings(
    updates: Partial<EditorSettings>
  ): Promise<Result<EditorSettings, SettingsError>> {
    const currentResult = await this.repository.loadSettings();
    if (!currentResult.ok) {
      return currentResult;
    }

    const next: EditorSettings = {
      assetsDirPath:
        updates.assetsDirPath === undefined ? currentResult.value.assetsDirPath : updates.assetsDirPath,
      gameExecutablePath:
        updates.gameExecutablePath === undefined
          ? currentResult.value.gameExecutablePath
          : updates.gameExecutablePath,
      defaultSky:
        updates.defaultSky === undefined ? currentResult.value.defaultSky : updates.defaultSky,
      defaultSoundfont:
        updates.defaultSoundfont === undefined ? currentResult.value.defaultSoundfont : updates.defaultSoundfont,
      defaultBgmusic:
        updates.defaultBgmusic === undefined ? currentResult.value.defaultBgmusic : updates.defaultBgmusic,
      defaultWallTex:
        updates.defaultWallTex === undefined ? currentResult.value.defaultWallTex : updates.defaultWallTex,
      defaultFloorTex:
        updates.defaultFloorTex === undefined ? currentResult.value.defaultFloorTex : updates.defaultFloorTex,
      defaultCeilTex:
        updates.defaultCeilTex === undefined ? currentResult.value.defaultCeilTex : updates.defaultCeilTex
    };

    const saveResult = await this.repository.saveSettings(next);
    if (!saveResult.ok) {
      return saveResult;
    }

    return { ok: true, value: next };
  }
}
