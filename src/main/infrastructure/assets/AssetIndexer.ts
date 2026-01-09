import path from 'node:path';

import type { AssetIndex } from '../../../shared/domain/models';
import type { AssetIndexError, Result } from '../../../shared/domain/results';
import type { DirectoryReader } from './directoryReader';

export type AssetIndexerDependencies = Readonly<{
  directoryReader: DirectoryReader;
  nowIso: () => string;
}>;

function toPosixRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

function toAssetIndexError(
  code: AssetIndexError['code'],
  message: string
): AssetIndexError {
  return {
    kind: 'asset-index-error',
    code,
    message
  };
}

export class AssetIndexer {
  private readonly directoryReader: DirectoryReader;
  private readonly nowIso: () => string;

  public constructor(dependencies: AssetIndexerDependencies) {
    this.directoryReader = dependencies.directoryReader;
    this.nowIso = dependencies.nowIso;
  }

  public async buildIndex(baseDir: string): Promise<Result<AssetIndex, AssetIndexError>> {
    if (baseDir.trim().length === 0) {
      return {
        ok: false,
        error: toAssetIndexError('asset-index/missing-base-dir', 'Assets directory path is not set')
      };
    }

    try {
      const entries: string[] = [];

      const visit = async (absoluteDir: string): Promise<void> => {
        const children = await this.directoryReader.readDir(absoluteDir);
        for (const child of children) {
          const childAbsolutePath = path.join(absoluteDir, child.name);
          if (child.isDirectory) {
            await visit(childAbsolutePath);
          } else {
            const rel = path.relative(baseDir, childAbsolutePath);
            entries.push(toPosixRelativePath(rel));
          }
        }
      };

      await visit(baseDir);
      entries.sort();

      return {
        ok: true,
        value: {
          baseDir,
          entries,
          stats: { fileCount: entries.length },
          builtAtIso: this.nowIso()
        }
      };
    } catch (_error: unknown) {
      return {
        ok: false,
        error: toAssetIndexError('asset-index/read-failed', 'Failed to index assets directory')
      };
    }
  }
}
