import { ReadAssetJsonTextService, type PathService, type TextFileReader } from './ReadAssetJsonTextService';

import type { AppStore } from '../store/AppStore';

describe('ReadAssetJsonTextService', () => {
  const createStore = (assetsDirPath: string | null): AppStore => {
    return {
      getState: () => ({
        settings: { assetsDirPath, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        recentMapPaths: [],
        mapDocument: null,
        mapRenderMode: 'textured',
        mapSectorSurface: 'floor',
        mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true },
        mapHighlightPortals: false,
        mapHighlightToggleWalls: false,
        mapDoorVisibility: 'visible'
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setRecentMapPaths: () => {},
      setMapDocument: () => {},
      setMapRenderMode: () => {},
      setMapSectorSurface: () => {},
      setMapGridIsVisible: () => {},
      setMapGridOpacity: () => {},
      setMapHighlightPortals: () => {},
      setMapHighlightToggleWalls: () => {},
      setMapDoorVisibility: () => {},
      setMapGridIsSnapToGridEnabled: () => {}
    } as unknown as AppStore;
  };

  it('rejects when assetsDirPath is missing', async () => {
    const service = new ReadAssetJsonTextService(
      createStore(null),
      {} as PathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText('file.json');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/missing-settings',
        message: 'Assets directory is not configured'
      }
    });
  });

  it('rejects when relative path is empty', async () => {
    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      {} as PathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText('   ');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/invalid-relative-path',
        message: 'Asset path is empty'
      }
    });
  });

  it('rejects when relative path contains null byte', async () => {
    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      {} as PathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText(`file\u0000.json`);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/invalid-relative-path',
        message: 'Asset path is invalid'
      }
    });
  });

  it('rejects when relative path is absolute', async () => {
    const pathService: PathService = {
      isAbsolute: () => true,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText('/etc/passwd');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/invalid-relative-path',
        message: 'Asset path must be relative'
      }
    });
  });

  it('rejects non-json extensions', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.txt',
      relative: () => 'file.txt'
    };

    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText('file.txt');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/unsupported-file-type',
        message: 'Only JSON files can be opened in the JSON editor'
      }
    });
  });

  it('rejects traversal outside base dir', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/outside',
      relative: () => '../outside'
    };

    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as TextFileReader
    );

    const result = await service.readJsonText('../outside.json');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/outside-base-dir',
        message: 'Asset path is outside the configured assets directory'
      }
    });
  });

  it('returns read-failed when file reader throws', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const fileReader: TextFileReader = {
      readFileText: async () => {
        throw new Error('nope');
      }
    };

    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      pathService,
      fileReader
    );

    const result = await service.readJsonText('file.json');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'read-asset-error',
        code: 'read-asset/read-failed',
        message: 'nope'
      }
    });
  });

  it('returns the file text on success', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const fileReader: TextFileReader = {
      readFileText: async () => '{"ok":true}'
    };

    const service = new ReadAssetJsonTextService(
      createStore('/assets'),
      pathService,
      fileReader
    );

    const result = await service.readJsonText('file.json');

    expect(result).toEqual({ ok: true, value: '{"ok":true}' });
  });
});
