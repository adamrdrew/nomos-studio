import path from 'node:path';

import type { AppStore } from '../store/AppStore';
import type { ProcessRunner } from '../../infrastructure/process/ProcessRunner';
import type { UserNotifier } from '../ui/UserNotifier';
import type { SaveMapService } from './SaveMapService';
import type { MapValidationService } from './MapValidationService';

export class SaveAndRunMapService {
  private readonly store: AppStore;
  private readonly saveMapService: SaveMapService;
  private readonly validator: MapValidationService;
  private readonly processRunner: ProcessRunner;
  private readonly notifier: UserNotifier;

  public constructor(
    store: AppStore,
    saveMapService: SaveMapService,
    validator: MapValidationService,
    processRunner: ProcessRunner,
    notifier: UserNotifier
  ) {
    this.store = store;
    this.saveMapService = saveMapService;
    this.validator = validator;
    this.processRunner = processRunner;
    this.notifier = notifier;
  }

  public async saveAndRunCurrentMap(): Promise<void> {
    const saveResult = await this.saveMapService.saveCurrentDocument();
    if (!saveResult.ok) {
      return;
    }

    const mapPath = saveResult.value.filePath;

    const validationResult = await this.validator.validateMap(mapPath);
    if (!validationResult.ok) {
      const isInvalidMap = validationResult.error.code === 'map-validation/invalid-map';

      await this.notifier.showError(
        isInvalidMap ? 'Map validation failed' : 'Map Validation Failed',
        isInvalidMap ? 'Map validation failed' : validationResult.error.message,
        validationResult.error.report?.prettyText
      );

      return;
    }

    const gameExecutablePath = this.store.getState().settings.gameExecutablePath;
    if (gameExecutablePath === null || gameExecutablePath.trim().length === 0) {
      await this.notifier.showError('Settings Required', 'Game executable path is not set. Open Settings to configure it.');
      return;
    }

    const mapFileName = path.basename(mapPath);

    try {
      await this.processRunner.run({
        command: gameExecutablePath,
        args: [mapFileName]
      });
    } catch (_error: unknown) {
      await this.notifier.showError('Run Failed', 'Failed to run game executable.');
    }
  }
}
