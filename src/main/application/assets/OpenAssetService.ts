import type { AppStore } from '../store/AppStore';
import type { OpenAssetError, Result } from '../../../shared/domain/results';

export type PathService = Readonly<{
  isAbsolute: (value: string) => boolean;
  resolve: (...segments: readonly string[]) => string;
  relative: (from: string, to: string) => string;
}>;

export type ShellOpener = Readonly<{
  openPath: (absolutePath: string) => Promise<string>;
}>;

export class OpenAssetService {
  public constructor(
    private readonly store: AppStore,
    private readonly pathService: PathService,
    private readonly shellOpener: ShellOpener
  ) {}

  public async openAsset(relativePath: string): Promise<Result<null, OpenAssetError>> {
    const assetsDirPath = this.store.getState().settings.assetsDirPath;
    if (assetsDirPath === null || assetsDirPath.trim().length === 0) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/missing-settings',
          message: 'Assets directory is not configured'
        }
      };
    }

    const assetsBaseDir = assetsDirPath.trim();

    const trimmed = relativePath.trim();
    if (trimmed.length === 0) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/invalid-relative-path',
          message: 'Asset path is empty'
        }
      };
    }

    if (trimmed.includes('\u0000')) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/invalid-relative-path',
          message: 'Asset path is invalid'
        }
      };
    }

    if (this.pathService.isAbsolute(trimmed)) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/invalid-relative-path',
          message: 'Asset path must be relative'
        }
      };
    }

    const absolutePath = this.pathService.resolve(assetsBaseDir, trimmed);
    const relativeToBase = this.pathService.relative(assetsBaseDir, absolutePath);

    const isTraversalOutsideBase =
      relativeToBase === '..' || relativeToBase.startsWith('../') || relativeToBase.startsWith('..\\');

    if (isTraversalOutsideBase || this.pathService.isAbsolute(relativeToBase)) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/outside-base-dir',
          message: 'Asset path is outside the configured assets directory'
        }
      };
    }

    const openResult = await this.shellOpener.openPath(absolutePath);
    if (openResult.length > 0) {
      return {
        ok: false as const,
        error: {
          kind: 'open-asset-error',
          code: 'open-asset/open-failed',
          message: openResult
        }
      };
    }

    return { ok: true as const, value: null };
  }
}
