import { OpenMapFromAssetsService } from './OpenMapFromAssetsService';
import type { AppStore } from '../store/AppStore';
import type { PathService } from '../assets/OpenAssetService';
import type { UserNotifier } from '../ui/UserNotifier';
import type { MapDocument } from '../../../shared/domain/models';
import type { OpenMapService } from './OpenMapService';

describe('OpenMapFromAssetsService', () => {
  const createStore = (assetsDirPath: string | null): AppStore => {
    return {
      getState: () => ({
        settings: { assetsDirPath, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;
  };

  it('rejects missing assetsDirPath', async () => {
    const store = createStore(null);

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/Levels/a.json',
      relative: () => 'Levels/a.json'
    };

    const notifierCalls: Array<{ title: string; message: string; detail?: string }> = [];
    const notifier: UserNotifier = {
      showError: async (title, message, detail) => {
        if (detail === undefined) {
          notifierCalls.push({ title, message });
        } else {
          notifierCalls.push({ title, message, detail });
        }
      },
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('Levels/a.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/missing-settings');
    }

    expect(notifierCalls.length).toBe(1);
    expect(notifierCalls[0]?.title).toBe('Settings Required');
  });

  it('rejects empty relativePath', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/Levels/a.json',
      relative: () => 'Levels/a.json'
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('   ');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/invalid-relative-path');
    }
  });

  it('rejects relativePath containing a null byte', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => {
        throw new Error('should not be called');
      },
      relative: () => {
        throw new Error('should not be called');
      }
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('Levels/a\u0000.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/invalid-relative-path');
    }
  });

  it('rejects absolute paths', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => true,
      resolve: () => '/assets/Levels/a.json',
      relative: () => 'Levels/a.json'
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('/etc/passwd');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/invalid-relative-path');
    }
  });

  it('rejects traversal outside base dir', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/../secret.json',
      relative: () => '../secret.json'
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('Levels/../secret.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/outside-base-dir');
    }
  });

  it('rejects when resolved path is not under base dir (relative returns absolute)', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: (value: string) => value.startsWith('/'),
      resolve: () => '/assets/Levels/a.json',
      relative: () => '/outside'
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openMapService: OpenMapService = {
      openMap: async () => {
        throw new Error('should not be called');
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('Levels/a.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('open-map-from-assets-error');
      expect(result.error.code).toBe('open-map-from-assets/outside-base-dir');
    }
  });

  it('delegates to OpenMapService.openMap on success', async () => {
    const store = createStore('/assets');

    const pathService: PathService = {
      isAbsolute: () => false,
      resolve: () => '/assets/Levels/a.json',
      relative: () => 'Levels/a.json'
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const openedPaths: string[] = [];
    const document: MapDocument = {
      filePath: '/assets/Levels/a.json',
      json: { ok: true },
      dirty: false,
      lastValidation: null,
      revision: 1
    };

    const openMapService: OpenMapService = {
      openMap: async (mapPath: string) => {
        openedPaths.push(mapPath);
        return { ok: true as const, value: document };
      }
    } as unknown as OpenMapService;

    const service = new OpenMapFromAssetsService(store, pathService, notifier, openMapService);

    const result = await service.openMapFromAssets('Levels/a.json');

    expect(result.ok).toBe(true);
    expect(openedPaths).toEqual(['/assets/Levels/a.json']);
  });
});
