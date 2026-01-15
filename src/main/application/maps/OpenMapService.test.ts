import { OpenMapService } from './OpenMapService';
import type { AppStore } from '../store/AppStore';
import type { MapValidationService } from './MapValidationService';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';
import type { UserNotifier } from '../ui/UserNotifier';
import type { MapDocument } from '../../../shared/domain/models';
import type { MapEditHistoryPort } from './MapEditHistory';

const nullHistory: MapEditHistoryPort = {
  clear: () => {},
  onMapOpened: () => {},
  recordEdit: () => {},
  getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
  undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'no' } }),
  redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'no' } })
};

describe('OpenMapService', () => {
  it('gates on missing settings and does not attempt validation', async () => {
    let validateCalled = 0;
    let errorShown = 0;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
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

    const validator: MapValidationService = {
      validateMap: async () => {
        validateCalled += 1;
        return { ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } };
      }
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => '{"ok":true}',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {
        errorShown += 1;
      },
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    expect(validateCalled).toBe(0);
    expect(errorShown).toBe(1);
  });

  it('gates when assets dir is missing (but game exe is set)', async () => {
    let validateCalled = 0;
    let lastErrorMessage: string | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const validator: MapValidationService = {
      validateMap: async () => {
        validateCalled += 1;
        return { ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } };
      }
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => '{"ok":true}',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async (_title, message) => {
        lastErrorMessage = message;
      },
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    expect(validateCalled).toBe(0);
    expect(lastErrorMessage).toContain('Assets directory path is not set');
  });

  it('gates when game executable is missing (but assets dir is set)', async () => {
    let validateCalled = 0;
    let lastErrorMessage: string | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: '/assets', gameExecutablePath: null },
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

    const validator: MapValidationService = {
      validateMap: async () => {
        validateCalled += 1;
        return { ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } };
      }
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => '{"ok":true}',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async (_title, message) => {
        lastErrorMessage = message;
      },
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    expect(validateCalled).toBe(0);
    expect(lastErrorMessage).toContain('Game executable path is not set');
  });

  it('does not load document when validation fails', async () => {
    let setDocumentCalls = 0;
    let lastErrorTitle: string | null = null;
    let lastErrorMessage: string | null = null;
    let lastErrorDetail: string | undefined = undefined;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: '/assets', gameExecutablePath: '/game' },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null,
        mapRenderMode: 'wireframe'
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {
        setDocumentCalls += 1;
      }
    } as unknown as AppStore;

    const validator: MapValidationService = {
      validateMap: async () => ({
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/invalid-map',
          message: 'nope',
          report: { kind: 'map-validation-error-report', rawText: 'raw', prettyText: 'pretty' }
        }
      })
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => '{"ok":true}',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async (title, message, detail) => {
        lastErrorTitle = title;
        lastErrorMessage = message;
        lastErrorDetail = detail;
      },
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    expect(setDocumentCalls).toBe(0);
    expect(lastErrorTitle).toBe('Map validation failed');
    expect(lastErrorMessage).toBe('Map validation failed');
    expect(lastErrorDetail).toBe('pretty');
  });

  it('loads and stores document on validation success', async () => {
    let storedPath: string | null = null;
    let storedRevision: number | null = null;
    let openedCount = 0;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: '/assets', gameExecutablePath: '/game' },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null,
        mapRenderMode: 'wireframe'
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: MapDocument | null) => {
        storedPath = doc?.filePath ?? null;
        storedRevision = doc?.revision ?? null;
      }
    } as unknown as AppStore;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => '{"a":1}',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const history: MapEditHistoryPort = {
      ...nullHistory,
      onMapOpened: () => {
        openedCount += 1;
      }
    };

    const service = new OpenMapService(store, validator, fs, notifier, history);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }
    expect(openedCount).toBe(1);
    expect(storedPath).not.toBeNull();
    expect(result.value.revision).toBe(1);
    expect(storedRevision).toBe(1);
  });

  it('returns parse-failed when file JSON is invalid', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: '/assets', gameExecutablePath: '/game' },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {
        throw new Error('unexpected');
      }
    } as unknown as AppStore;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => 'not-json',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('map-io-error');
      if (result.error.kind === 'map-io-error') {
        expect(result.error.code).toBe('map-io/parse-failed');
      }
    }
  });

  it('returns read-failed when file read throws', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: '/assets', gameExecutablePath: '/game' },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {
        throw new Error('unexpected');
      }
    } as unknown as AppStore;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-09T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const fs: FileSystem = {
      readFile: async () => {
        throw new Error('read failed');
      },
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new OpenMapService(store, validator, fs, notifier, nullHistory);

    const result = await service.openMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('map-io-error');
      if (result.error.kind === 'map-io-error') {
        expect(result.error.code).toBe('map-io/read-failed');
      }
    }
  });
});
