import { WriteAssetJsonTextService, type PathService } from './WriteAssetJsonTextService';

import type { AppStore } from '../store/AppStore';
import type { UserNotifier } from '../ui/UserNotifier';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';

describe('WriteAssetJsonTextService', () => {
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

  const createNotifier = (): { notifier: UserNotifier; calls: Array<Readonly<{ title: string; message: string }>> } => {
    const calls: Array<Readonly<{ title: string; message: string }>> = [];
    const notifier: UserNotifier = {
      showError: async (title, message) => {
        calls.push({ title, message });
      },
      showInfo: async () => {}
    };

    return { notifier, calls };
  };

  it('rejects when assetsDirPath is missing', async () => {
    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore(null),
      {} as PathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/missing-settings',
        message: 'Assets directory is not configured'
      }
    });
  });

  it('rejects when assetsDirPath is whitespace-only', async () => {
    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('   '),
      {} as PathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/missing-settings',
        message: 'Assets directory is not configured'
      }
    });
  });

  it('rejects when relative path is empty', async () => {
    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('/assets'),
      {} as PathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('   ', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/invalid-relative-path',
        message: 'Asset path is empty'
      }
    });
  });

  it('rejects when relative path contains null byte', async () => {
    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('/assets'),
      {} as PathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText(`file\u0000.json`, '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/invalid-relative-path',
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

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('/etc/passwd', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/invalid-relative-path',
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

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('file.txt', 'hello');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/unsupported-file-type',
        message: 'Only JSON files can be saved'
      }
    });
  });

  it('rejects traversal outside base dir', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/outside',
      relative: () => '../outside'
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(
      createStore('/assets'),
      pathService,
      {} as FileSystem,
      notifier
    );

    const result = await service.writeJsonText('../outside.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/outside-base-dir',
        message: 'Asset path is outside the configured assets directory'
      }
    });
  });

  it('rejects when the resolved path is not under the base dir (relativeToBase is absolute)', async () => {
    const isAbsolute = jest
      .fn()
      .mockReturnValueOnce(false) // trimmed input is relative
      .mockReturnValueOnce(true); // relativeToBase is absolute

    const pathService: PathService = {
      isAbsolute,
      resolve: () => '/assets/file.json',
      relative: () => '/absolute/escape'
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, {} as FileSystem, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/outside-base-dir',
        message: 'Asset path is outside the configured assets directory'
      }
    });
  });

  it('uses a backup + replace flow when rename fails with EEXIST', async () => {
    const calls: string[] = [];

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    let renameTmpToDestAttempts = 0;

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('unexpected');
      },
      mkdir: async () => {
        calls.push('mkdir');
      },
      writeFile: async () => {
        calls.push('writeFile');
      },
      rename: async (oldPath, newPath) => {
        calls.push(`rename:${oldPath}->${newPath}`);

        if (oldPath === '/assets/file.json.tmp' && newPath === '/assets/file.json') {
          renameTmpToDestAttempts += 1;
          if (renameTmpToDestAttempts === 1) {
            const error = new Error('exists') as NodeJS.ErrnoException;
            error.code = 'EEXIST';
            throw error;
          }
        }
      },
      unlink: async (filePath) => {
        calls.push(`unlink:${filePath}`);
      }
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, fs, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({ ok: true, value: null });
    expect(calls).toEqual([
      'mkdir',
      'writeFile',
      'rename:/assets/file.json.tmp->/assets/file.json',
      'rename:/assets/file.json->/assets/file.json.bak',
      'rename:/assets/file.json.tmp->/assets/file.json',
      'unlink:/assets/file.json.bak'
    ]);
  });

  it('restores the backup if the replace fails after creating the backup', async () => {
    const calls: string[] = [];

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    let renameTmpToDestAttempts = 0;

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('unexpected');
      },
      mkdir: async () => {
        calls.push('mkdir');
      },
      writeFile: async () => {
        calls.push('writeFile');
      },
      rename: async (oldPath, newPath) => {
        calls.push(`rename:${oldPath}->${newPath}`);

        if (oldPath === '/assets/file.json.tmp' && newPath === '/assets/file.json') {
          renameTmpToDestAttempts += 1;
          const error = new Error('perm') as NodeJS.ErrnoException;
          error.code = renameTmpToDestAttempts === 1 ? 'EPERM' : 'EPERM';
          throw error;
        }
      },
      unlink: async (filePath) => {
        calls.push(`unlink:${filePath}`);
      }
    };

    const { notifier, calls: notifierCalls } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, fs, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/write-failed',
        message: 'perm'
      }
    });

    expect(notifierCalls.at(-1)).toEqual({ title: 'Save Failed', message: 'Failed to write JSON file.' });

    // Should attempt backup/restore, then cleanup tmp.
    expect(calls).toEqual([
      'mkdir',
      'writeFile',
      'rename:/assets/file.json.tmp->/assets/file.json',
      'rename:/assets/file.json->/assets/file.json.bak',
      'rename:/assets/file.json.tmp->/assets/file.json',
      'rename:/assets/file.json.bak->/assets/file.json',
      'unlink:/assets/file.json.tmp'
    ]);
  });

  it('returns write-failed when write throws', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('unexpected');
      },
      mkdir: async () => {},
      writeFile: async () => {
        throw new Error('nope');
      },
      rename: async () => {},
      unlink: async () => {}
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, fs, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/write-failed',
        message: 'nope'
      }
    });
  });

  it('returns write-failed with default message when write throws a non-Error value', async () => {
    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('unexpected');
      },
      mkdir: async () => {},
      writeFile: async () => {
        // eslint-disable-next-line no-throw-literal
        throw 'nope';
      },
      rename: async () => {},
      unlink: async () => {}
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, fs, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'write-asset-error',
        code: 'write-asset/write-failed',
        message: 'Failed to write asset file'
      }
    });
  });

  it('writes tmp then renames to destination on success', async () => {
    const calls: string[] = [];

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/file.json',
      relative: () => 'file.json'
    };

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('unexpected');
      },
      mkdir: async () => {
        calls.push('mkdir');
      },
      writeFile: async () => {
        calls.push('writeFile');
      },
      rename: async (oldPath, newPath) => {
        calls.push(`rename:${oldPath}->${newPath}`);
      },
      unlink: async () => {
        calls.push('unlink');
      }
    };

    const { notifier } = createNotifier();

    const service = new WriteAssetJsonTextService(createStore('/assets'), pathService, fs, notifier);

    const result = await service.writeJsonText('file.json', '{"x":1}');

    expect(result).toEqual({ ok: true, value: null });
    expect(calls).toEqual(['mkdir', 'writeFile', 'rename:/assets/file.json.tmp->/assets/file.json']);
  });
});
