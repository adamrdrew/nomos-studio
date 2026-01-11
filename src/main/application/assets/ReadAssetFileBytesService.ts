import type { AppStore } from '../store/AppStore';
import type { ReadAssetError, Result } from '../../../shared/domain/results';

export type PathService = Readonly<{
  isAbsolute: (value: string) => boolean;
  resolve: (...segments: readonly string[]) => string;
  relative: (from: string, to: string) => string;
}>;

export type BinaryFileReader = Readonly<{
  readFileBytes: (absolutePath: string) => Promise<Uint8Array>;
}>;

export class ReadAssetFileBytesService {
  public constructor(
    private readonly store: AppStore,
    private readonly pathService: PathService,
    private readonly fileReader: BinaryFileReader
  ) {}

  public async readFileBytes(relativePath: string): Promise<Result<Uint8Array, ReadAssetError>> {
    const assetsDirPath = this.store.getState().settings.assetsDirPath;
    if (assetsDirPath === null || assetsDirPath.trim().length === 0) {
      return {
        ok: false as const,
        error: {
          kind: 'read-asset-error',
          code: 'read-asset/missing-settings',
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
          kind: 'read-asset-error',
          code: 'read-asset/invalid-relative-path',
          message: 'Asset path is empty'
        }
      };
    }

    if (trimmed.includes('\u0000')) {
      return {
        ok: false as const,
        error: {
          kind: 'read-asset-error',
          code: 'read-asset/invalid-relative-path',
          message: 'Asset path is invalid'
        }
      };
    }

    if (this.pathService.isAbsolute(trimmed)) {
      return {
        ok: false as const,
        error: {
          kind: 'read-asset-error',
          code: 'read-asset/invalid-relative-path',
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
          kind: 'read-asset-error',
          code: 'read-asset/outside-base-dir',
          message: 'Asset path is outside the configured assets directory'
        }
      };
    }

    try {
      const bytes = await this.fileReader.readFileBytes(absolutePath);
      return { ok: true as const, value: bytes };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to read asset file';
      return {
        ok: false as const,
        error: {
          kind: 'read-asset-error',
          code: 'read-asset/read-failed',
          message
        }
      };
    }
  }
}
