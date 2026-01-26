import type { AppStore } from '../store/AppStore';
import type { ReadAssetError, Result } from '../../../shared/domain/results';

export type PathService = Readonly<{
  isAbsolute: (value: string) => boolean;
  resolve: (...segments: readonly string[]) => string;
  relative: (from: string, to: string) => string;
}>;

export type TextFileReader = Readonly<{
  readFileText: (absolutePath: string) => Promise<string>;
}>;

export class ReadAssetJsonTextService {
  public constructor(
    private readonly store: AppStore,
    private readonly pathService: PathService,
    private readonly fileReader: TextFileReader
  ) {}

  public async readJsonText(relativePath: string): Promise<Result<string, ReadAssetError>> {
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

    if (!trimmed.toLowerCase().endsWith('.json')) {
      return {
        ok: false as const,
        error: {
          kind: 'read-asset-error',
          code: 'read-asset/unsupported-file-type',
          message: 'Only JSON files can be opened in the JSON editor'
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
      const text = await this.fileReader.readFileText(absolutePath);
      return { ok: true as const, value: text };
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
