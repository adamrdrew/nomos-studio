import { AppStore } from './AppStore';

import type { AssetIndex, MapDocument } from '../../../shared/domain/models';
import type { AssetIndexError } from '../../../shared/domain/results';

describe('AppStore', () => {
  it('initializes with default state', () => {
    const store = new AppStore();

    const state = store.getState();

    expect(state.settings).toEqual({ assetsDirPath: null, gameExecutablePath: null });
    expect(state.assetIndex).toBeNull();
    expect(state.assetIndexError).toBeNull();
    expect(state.mapDocument).toBeNull();
  });

  it('notifies subscribers on state changes and unsubscribe stops notifications', () => {
    const store = new AppStore();

    let calls = 0;
    let lastSettings: unknown = null;

    const unsubscribe = store.subscribe((state) => {
      calls += 1;
      lastSettings = state.settings;
    });

    store.setSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(calls).toBe(1);
    expect(lastSettings).toEqual({ assetsDirPath: '/assets', gameExecutablePath: null });

    unsubscribe();

    store.setSettings({ assetsDirPath: null, gameExecutablePath: '/game' });

    expect(calls).toBe(1);
  });

  it('setAssetIndex clears assetIndexError', () => {
    const store = new AppStore();

    const error: AssetIndexError = {
      kind: 'asset-index-error',
      code: 'asset-index/read-failed',
      message: 'nope'
    };

    const index: AssetIndex = {
      baseDir: '/assets',
      entries: ['a'],
      stats: { fileCount: 1 },
      builtAtIso: '2026-01-09T00:00:00.000Z'
    };

    store.setAssetIndexError(error);
    expect(store.getState().assetIndex).toBeNull();
    expect(store.getState().assetIndexError).toEqual(error);

    store.setAssetIndex(index);

    expect(store.getState().assetIndex).toEqual(index);
    expect(store.getState().assetIndexError).toBeNull();
  });

  it('setAssetIndexError clears assetIndex', () => {
    const store = new AppStore();

    const index: AssetIndex = {
      baseDir: '/assets',
      entries: ['a'],
      stats: { fileCount: 1 },
      builtAtIso: '2026-01-09T00:00:00.000Z'
    };

    const error: AssetIndexError = {
      kind: 'asset-index-error',
      code: 'asset-index/read-failed',
      message: 'nope'
    };

    store.setAssetIndex(index);
    expect(store.getState().assetIndex).toEqual(index);
    expect(store.getState().assetIndexError).toBeNull();

    store.setAssetIndexError(error);

    expect(store.getState().assetIndex).toBeNull();
    expect(store.getState().assetIndexError).toEqual(error);
  });

  it('setMapDocument stores document and supports clearing it', () => {
    const store = new AppStore();

    const document: MapDocument = {
      filePath: '/maps/test.json',
      json: { a: 1 },
      dirty: false,
      lastValidation: null
    };

    store.setMapDocument(document);
    expect(store.getState().mapDocument).toEqual(document);

    store.setMapDocument(null);
    expect(store.getState().mapDocument).toBeNull();
  });
});
