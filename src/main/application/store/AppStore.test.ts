import { AppStore } from './AppStore';

import type { AssetIndex, MapDocument } from '../../../shared/domain/models';
import type { AssetIndexError } from '../../../shared/domain/results';

describe('AppStore', () => {
  it('initializes with default state', () => {
    const store = new AppStore();

    const state = store.getState();

    expect(state.settings).toEqual({
      assetsDirPath: null,
      gameExecutablePath: null,
      defaultSky: null,
      defaultSoundfont: null,
      defaultBgmusic: null,
      defaultWallTex: null,
      defaultFloorTex: null,
      defaultCeilTex: null
    });
    expect(state.assetIndex).toBeNull();
    expect(state.assetIndexError).toBeNull();
    expect(state.recentMapPaths).toEqual([]);
    expect(state.mapDocument).toBeNull();
    expect(state.mapRenderMode).toBe('textured');
    expect(state.mapSectorSurface).toBe('floor');
    expect(state.mapGridSettings).toEqual({ isGridVisible: true, gridOpacity: 0.3 });
    expect(state.mapHighlightPortals).toBe(false);
    expect(state.mapHighlightToggleWalls).toBe(false);
    expect(state.mapDoorVisibility).toBe('visible');
  });

  it('notifies subscribers on state changes and unsubscribe stops notifications', () => {
    const store = new AppStore();

    let calls = 0;
    let lastSettings: unknown = null;

    const unsubscribe = store.subscribe((state) => {
      calls += 1;
      lastSettings = state.settings;
    });

    store.setSettings({
      assetsDirPath: '/assets',
      gameExecutablePath: null,
      defaultSky: null,
      defaultSoundfont: null,
      defaultBgmusic: null,
      defaultWallTex: null,
      defaultFloorTex: null,
      defaultCeilTex: null
    });

    expect(calls).toBe(1);
    expect(lastSettings).toEqual({
      assetsDirPath: '/assets',
      gameExecutablePath: null,
      defaultSky: null,
      defaultSoundfont: null,
      defaultBgmusic: null,
      defaultWallTex: null,
      defaultFloorTex: null,
      defaultCeilTex: null
    });

    unsubscribe();

    store.setSettings({
      assetsDirPath: null,
      gameExecutablePath: '/game',
      defaultSky: null,
      defaultSoundfont: null,
      defaultBgmusic: null,
      defaultWallTex: null,
      defaultFloorTex: null,
      defaultCeilTex: null
    });

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
      lastValidation: null,
      revision: 1
    };

    store.setMapDocument(document);
    expect(store.getState().mapDocument).toEqual(document);

    store.setMapDocument(null);
    expect(store.getState().mapDocument).toBeNull();
  });

  it('setRecentMapPaths stores recent map paths', () => {
    const store = new AppStore();

    store.setRecentMapPaths(['/a', '/b']);

    expect(store.getState().recentMapPaths).toEqual(['/a', '/b']);
  });

  it('setMapRenderMode stores the mode', () => {
    const store = new AppStore();

    store.setMapRenderMode('textured');
    expect(store.getState().mapRenderMode).toBe('textured');
  });

  it('setMapSectorSurface stores the surface and toggleMapSectorSurface flips it', () => {
    const store = new AppStore();

    expect(store.getState().mapSectorSurface).toBe('floor');

    store.setMapSectorSurface('ceiling');
    expect(store.getState().mapSectorSurface).toBe('ceiling');

    store.setMapSectorSurface('floor');
    expect(store.getState().mapSectorSurface).toBe('floor');

    store.toggleMapSectorSurface();
    expect(store.getState().mapSectorSurface).toBe('ceiling');

    store.toggleMapSectorSurface();
    expect(store.getState().mapSectorSurface).toBe('floor');
  });

  it('mapSectorSurface updates notify subscribers', () => {
    const store = new AppStore();

    let calls = 0;
    let lastSurface: unknown = null;

    store.subscribe((state) => {
      calls += 1;
      lastSurface = state.mapSectorSurface;
    });

    store.toggleMapSectorSurface();
    expect(calls).toBe(1);
    expect(lastSurface).toBe('ceiling');

    store.setMapSectorSurface('floor');
    expect(calls).toBe(2);
    expect(lastSurface).toBe('floor');
  });

  it('setMapGridIsVisible stores visibility and preserves opacity', () => {
    const store = new AppStore();

    store.setMapGridOpacity(0.6);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: true, gridOpacity: 0.6 });

    store.setMapGridIsVisible(false);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.6 });
  });

  it('setMapGridOpacity clamps opacity and preserves visibility', () => {
    const store = new AppStore();

    store.setMapGridIsVisible(false);
    expect(store.getState().mapGridSettings.isGridVisible).toBe(false);

    store.setMapGridOpacity(0.5);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.5 });

    store.setMapGridOpacity(0.01);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.1 });

    store.setMapGridOpacity(10);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.8 });

    store.setMapGridOpacity(Number.NaN);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.1 });

    store.setMapGridOpacity(0.36);
    expect(store.getState().mapGridSettings).toEqual({ isGridVisible: false, gridOpacity: 0.4 });
  });

  it('setMapHighlightPortals stores the flag', () => {
    const store = new AppStore();

    store.setMapHighlightPortals(true);
    expect(store.getState().mapHighlightPortals).toBe(true);

    store.setMapHighlightPortals(false);
    expect(store.getState().mapHighlightPortals).toBe(false);
  });

  it('toggleMapHighlightPortals flips the flag', () => {
    const store = new AppStore();

    expect(store.getState().mapHighlightPortals).toBe(false);
    store.toggleMapHighlightPortals();
    expect(store.getState().mapHighlightPortals).toBe(true);
    store.toggleMapHighlightPortals();
    expect(store.getState().mapHighlightPortals).toBe(false);
  });

  it('setMapHighlightToggleWalls stores the flag', () => {
    const store = new AppStore();

    store.setMapHighlightToggleWalls(true);
    expect(store.getState().mapHighlightToggleWalls).toBe(true);

    store.setMapHighlightToggleWalls(false);
    expect(store.getState().mapHighlightToggleWalls).toBe(false);
  });

  it('toggleMapHighlightToggleWalls flips the flag', () => {
    const store = new AppStore();

    expect(store.getState().mapHighlightToggleWalls).toBe(false);
    store.toggleMapHighlightToggleWalls();
    expect(store.getState().mapHighlightToggleWalls).toBe(true);
    store.toggleMapHighlightToggleWalls();
    expect(store.getState().mapHighlightToggleWalls).toBe(false);
  });

  it('setMapDoorVisibility stores the visibility', () => {
    const store = new AppStore();

    store.setMapDoorVisibility('hidden');
    expect(store.getState().mapDoorVisibility).toBe('hidden');

    store.setMapDoorVisibility('visible');
    expect(store.getState().mapDoorVisibility).toBe('visible');
  });

  it('toggleMapDoorVisibility flips between visible and hidden', () => {
    const store = new AppStore();

    expect(store.getState().mapDoorVisibility).toBe('visible');
    store.toggleMapDoorVisibility();
    expect(store.getState().mapDoorVisibility).toBe('hidden');
    store.toggleMapDoorVisibility();
    expect(store.getState().mapDoorVisibility).toBe('visible');
  });
});
