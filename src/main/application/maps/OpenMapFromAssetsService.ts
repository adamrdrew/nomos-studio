import type { MapDocument } from '../../../shared/domain/models';
import type { MapIoError, MapValidationError, OpenMapFromAssetsError, Result } from '../../../shared/domain/results';
import type { PathService } from '../assets/OpenAssetService';
import type { AppStore } from '../store/AppStore';
import type { UserNotifier } from '../ui/UserNotifier';
import type { OpenMapService } from './OpenMapService';

function toError(code: OpenMapFromAssetsError['code'], message: string): OpenMapFromAssetsError {
  return { kind: 'open-map-from-assets-error', code, message };
}

export class OpenMapFromAssetsService {
  public constructor(
    private readonly store: AppStore,
    private readonly pathService: PathService,
    private readonly notifier: UserNotifier,
    private readonly openMapService: OpenMapService
  ) {}

  public async openMapFromAssets(
    relativePath: string
  ): Promise<Result<MapDocument, OpenMapFromAssetsError | MapIoError | MapValidationError>> {
    const assetsDirPath = this.store.getState().settings.assetsDirPath;
    if (assetsDirPath === null || assetsDirPath.trim().length === 0) {
      await this.notifier.showError(
        'Settings Required',
        'Assets directory path is not set. Open Settings to configure it.'
      );
      return {
        ok: false as const,
        error: toError('open-map-from-assets/missing-settings', 'Assets directory is not configured')
      };
    }

    const assetsBaseDir = assetsDirPath.trim();

    const trimmed = relativePath.trim();
    if (trimmed.length === 0 || trimmed.includes('\u0000')) {
      await this.notifier.showError('Open Map Failed', 'Asset path is invalid.');
      return {
        ok: false as const,
        error: toError('open-map-from-assets/invalid-relative-path', 'Asset path is invalid')
      };
    }

    if (this.pathService.isAbsolute(trimmed)) {
      await this.notifier.showError('Open Map Failed', 'Asset path must be relative.');
      return {
        ok: false as const,
        error: toError('open-map-from-assets/invalid-relative-path', 'Asset path must be relative')
      };
    }

    const absolutePath = this.pathService.resolve(assetsBaseDir, trimmed);
    const relativeToBase = this.pathService.relative(assetsBaseDir, absolutePath);

    const isTraversalOutsideBase =
      relativeToBase === '..' || relativeToBase.startsWith('../') || relativeToBase.startsWith('..\\');

    if (isTraversalOutsideBase || this.pathService.isAbsolute(relativeToBase)) {
      await this.notifier.showError('Open Map Failed', 'Asset path is outside the configured assets directory.');
      return {
        ok: false as const,
        error: toError('open-map-from-assets/outside-base-dir', 'Asset path is outside the configured assets directory')
      };
    }

    return this.openMapService.openMap(absolutePath);
  }
}