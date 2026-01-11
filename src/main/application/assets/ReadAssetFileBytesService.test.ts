import { ReadAssetFileBytesService, type BinaryFileReader, type PathService } from './ReadAssetFileBytesService';

import type { AppStore } from '../store/AppStore';

describe('ReadAssetFileBytesService', () => {
  const createStore = (assetsDirPath: string | null): AppStore => {
    return {
      getState: () => ({
        settings: { assetsDirPath, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null,
        mapRenderMode: 'wireframe'
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {},
      setMapRenderMode: () => {}
    } as unknown as AppStore;
  };

  it('returns missing-settings when assets dir is unset', async () => {
    const store = createStore(null);

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => {
        throw new Error('unexpected');
      },
      relative: () => {
        throw new Error('unexpected');
      }
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        throw new Error('unexpected');
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('Images/Textures/TEX.png');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/missing-settings');
    }
  });

  it('rejects empty relative path', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => {
        throw new Error('unexpected');
      },
      relative: () => {
        throw new Error('unexpected');
      }
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        throw new Error('unexpected');
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('   ');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/invalid-relative-path');
    }
  });

  it('rejects null characters in the relative path', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => {
        throw new Error('unexpected');
      },
      relative: () => {
        throw new Error('unexpected');
      }
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        throw new Error('unexpected');
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes(`file\u0000.png`);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/invalid-relative-path');
    }
  });

  it('rejects absolute paths', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: (value) => value.startsWith('/'),
      resolve: () => {
        throw new Error('unexpected');
      },
      relative: () => {
        throw new Error('unexpected');
      }
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        throw new Error('unexpected');
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('/etc/passwd');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/invalid-relative-path');
    }
  });

  it('rejects paths that resolve outside the assets dir', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: (baseDir, relativePath) => {
        void baseDir;
        void relativePath;
        return '/outside';
      },
      relative: () => '../outside'
    };

    let readCalls = 0;
    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        readCalls += 1;
        return new Uint8Array([1, 2, 3]);
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('../outside');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/outside-base-dir');
    }
    expect(readCalls).toBe(0);
  });

  it('returns read-failed when the file read throws', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: (baseDir, relativePath) => {
        void baseDir;
        return `/assets/${relativePath}`;
      },
      relative: () => 'file.png'
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => {
        throw new Error('nope');
      }
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('file.png');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('read-asset/read-failed');
      expect(result.error.message).toBe('nope');
    }
  });

  it('reads bytes for an in-base path', async () => {
    const store = createStore('  /assets  ');

    let resolvedPath: string | null = null;

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: (baseDir, relativePath) => {
        resolvedPath = `${baseDir}/${relativePath}`;
        return resolvedPath;
      },
      relative: () => 'Images/Textures/file.png'
    };

    const fileReader: BinaryFileReader = {
      readFileBytes: async () => new Uint8Array([4, 5])
    };

    const service = new ReadAssetFileBytesService(store, pathService, fileReader);

    const result = await service.readFileBytes('Images/Textures/file.png');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(new Uint8Array([4, 5]));
    }
    expect(resolvedPath).toBe('/assets/Images/Textures/file.png');
  });
});
