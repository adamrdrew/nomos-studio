import path from 'node:path';

import type { MapDocument } from '../../../shared/domain/models';
import type { MapIoError, MapValidationError, Result } from '../../../shared/domain/results';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';
import type { AppStore } from '../store/AppStore';
import type { MapValidationService } from './MapValidationService';
import type { UserNotifier } from '../ui/UserNotifier';

function toMapIoError(code: MapIoError['code'], message: string): MapIoError {
  return { kind: 'map-io-error', code, message };
}

export class OpenMapService {
  private readonly store: AppStore;
  private readonly validator: MapValidationService;
  private readonly fs: FileSystem;
  private readonly notifier: UserNotifier;

  public constructor(
    store: AppStore,
    validator: MapValidationService,
    fs: FileSystem,
    notifier: UserNotifier
  ) {
    this.store = store;
    this.validator = validator;
    this.fs = fs;
    this.notifier = notifier;
  }

  public async openMap(mapPath: string): Promise<Result<MapDocument, MapIoError | MapValidationError>> {
    const settings = this.store.getState().settings;

    const missingAssetsDir = settings.assetsDirPath === null || settings.assetsDirPath.trim().length === 0;
    const missingGameExe =
      settings.gameExecutablePath === null || settings.gameExecutablePath.trim().length === 0;

    if (missingAssetsDir || missingGameExe) {
      const message =
        missingAssetsDir && missingGameExe
          ? 'Assets directory and game executable path are not set.'
          : missingAssetsDir
            ? 'Assets directory path is not set.'
            : 'Game executable path is not set.';

      await this.notifier.showError('Settings Required', `${message} Open Settings to configure them.`);

      return {
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/missing-settings',
          message
        }
      };
    }

    const validationResult = await this.validator.validateMap(mapPath);
    if (!validationResult.ok) {
      const isInvalidMap = validationResult.error.code === 'map-validation/invalid-map';

      await this.notifier.showError(
        isInvalidMap ? 'Map validation failed' : 'Map Validation Failed',
        isInvalidMap ? 'Map validation failed' : validationResult.error.message,
        validationResult.error.report?.prettyText
      );
      return { ok: false, error: validationResult.error };
    }

    const absolutePath = path.resolve(mapPath);

    let raw: string;
    try {
      raw = await this.fs.readFile(absolutePath, 'utf8');
    } catch (_error: unknown) {
      await this.notifier.showError('Open Map Failed', 'Failed to read the selected map file.');
      return { ok: false, error: toMapIoError('map-io/read-failed', 'Failed to read map file') };
    }

    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch (_error: unknown) {
      await this.notifier.showError('Open Map Failed', 'Selected file is not valid JSON.');
      return { ok: false, error: toMapIoError('map-io/parse-failed', 'Failed to parse map JSON') };
    }

    const document: MapDocument = {
      filePath: absolutePath,
      json,
      dirty: false,
      lastValidation: validationResult.value
    };

    this.store.setMapDocument(document);

    return { ok: true, value: document };
  }
}
