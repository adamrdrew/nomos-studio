import { AssetIndexService } from './AssetIndexService';
import type { AppStore } from '../store/AppStore';
import type { AssetIndexer } from '../../infrastructure/assets/AssetIndexer';

describe('AssetIndexService', () => {
  it('returns missing-base-dir and stores error when assets dir is unset', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {
        throw new Error('unexpected');
      },
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const indexer: AssetIndexer = {
      buildIndex: async () => {
        throw new Error('unexpected');
      }
    } as unknown as AssetIndexer;

    const service = new AssetIndexService(store, indexer);

    const result = await service.refreshIndex();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('asset-index/missing-base-dir');
    }
  });

  it('stores index on success', async () => {
    let storedIndexCount = 0;

    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: '/assets',
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {
        storedIndexCount += 1;
      },
      setAssetIndexError: () => {
        throw new Error('unexpected');
      },
      setMapDocument: () => {}
    } as unknown as AppStore;

    const indexer: AssetIndexer = {
      buildIndex: async () => ({
        ok: true,
        value: {
          baseDir: '/assets',
          entries: ['a'],
          stats: { fileCount: 1 },
          builtAtIso: '2026-01-09T00:00:00.000Z'
        }
      })
    } as unknown as AssetIndexer;

    const service = new AssetIndexService(store, indexer);

    const result = await service.refreshIndex();

    expect(result.ok).toBe(true);
    expect(storedIndexCount).toBe(1);
  });

  it('stores error when indexer fails', async () => {
    let storedErrorCount = 0;

    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: '/assets',
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {
        throw new Error('unexpected');
      },
      setAssetIndexError: () => {
        storedErrorCount += 1;
      },
      setMapDocument: () => {}
    } as unknown as AppStore;

    const indexer: AssetIndexer = {
      buildIndex: async () => ({
        ok: false,
        error: {
          kind: 'asset-index-error',
          code: 'asset-index/read-failed',
          message: 'nope'
        }
      })
    } as unknown as AssetIndexer;

    const service = new AssetIndexService(store, indexer);

    const result = await service.refreshIndex();

    expect(result.ok).toBe(false);
    expect(storedErrorCount).toBe(1);
  });
});
