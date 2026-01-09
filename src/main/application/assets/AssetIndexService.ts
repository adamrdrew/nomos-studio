import type { AssetIndex } from '../../../shared/domain/models';
import type { AssetIndexError, Result } from '../../../shared/domain/results';
import type { AppStore } from '../store/AppStore';
import type { AssetIndexer } from '../../infrastructure/assets/AssetIndexer';

export class AssetIndexService {
  private readonly store: AppStore;
  private readonly indexer: AssetIndexer;

  public constructor(store: AppStore, indexer: AssetIndexer) {
    this.store = store;
    this.indexer = indexer;
  }

  public async refreshIndex(): Promise<Result<AssetIndex, AssetIndexError>> {
    const baseDir = this.store.getState().settings.assetsDirPath;
    if (baseDir === null || baseDir.trim().length === 0) {
      const error: AssetIndexError = {
        kind: 'asset-index-error',
        code: 'asset-index/missing-base-dir',
        message: 'Assets directory path is not set'
      };
      this.store.setAssetIndexError(error);
      return { ok: false, error };
    }

    const result = await this.indexer.buildIndex(baseDir);
    if (!result.ok) {
      this.store.setAssetIndexError(result.error);
      return result;
    }

    this.store.setAssetIndex(result.value);
    return result;
  }
}
