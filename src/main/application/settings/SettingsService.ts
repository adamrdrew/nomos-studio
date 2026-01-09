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
          : updates.gameExecutablePath
    };

    const saveResult = await this.repository.saveSettings(next);
    if (!saveResult.ok) {
      return saveResult;
    }

    return { ok: true, value: next };
  }
}
