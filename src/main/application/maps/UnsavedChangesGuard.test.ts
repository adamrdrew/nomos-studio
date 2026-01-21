import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import type { AppStore } from '../store/AppStore';
import type { UserPrompter } from '../ui/UserPrompter';
import type { SaveMapService } from './SaveMapService';
import type { MapDocument } from '../../../shared/domain/models';

function createStore(mapDocument: MapDocument | null): AppStore {
  return {
    getState: () => ({
      settings: { assetsDirPath: null, gameExecutablePath: null },
      assetIndex: null,
      assetIndexError: null,
      mapDocument,
      mapRenderMode: 'textured',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible'
    }),
    subscribe: () => () => {},
    setSettings: () => {},
    setAssetIndex: () => {},
    setAssetIndexError: () => {},
    setMapDocument: () => {},
    setMapRenderMode: () => {},
    setMapSectorSurface: () => {},
    toggleMapSectorSurface: () => {},
    setMapGridIsVisible: () => {},
    setMapGridOpacity: () => {},
    setMapHighlightPortals: () => {},
    toggleMapHighlightPortals: () => {},
    setMapDoorVisibility: () => {},
    toggleMapDoorVisibility: () => {}
  } as unknown as AppStore;
}

function baseDocument(overrides: Partial<MapDocument> = {}): MapDocument {
  return {
    filePath: '/maps/test.json',
    json: { a: 1 },
    dirty: false,
    lastValidation: null,
    revision: 1,
    ...overrides
  };
}

describe('UnsavedChangesGuard', () => {
  it('proceeds immediately when no document is loaded', async () => {
    let actionCalls = 0;
    let promptCalls = 0;
    let saveCalls = 0;

    const store = createStore(null);

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async () => {
        promptCalls += 1;
        return 'cancel';
      }
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        saveCalls += 1;
        return { ok: false, error: { kind: 'map-io-error', code: 'map-io/no-document', message: 'nope' } };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      actionCalls += 1;
    });

    expect(result.proceeded).toBe(true);
    expect(actionCalls).toBe(1);
    expect(promptCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it('proceeds immediately when the loaded document is not dirty', async () => {
    let actionCalls = 0;
    let promptCalls = 0;
    let saveCalls = 0;

    const store = createStore(baseDocument({ dirty: false }));

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async () => {
        promptCalls += 1;
        return 'cancel';
      }
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        saveCalls += 1;
        return { ok: false, error: { kind: 'map-io-error', code: 'map-io/no-document', message: 'nope' } };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      actionCalls += 1;
    });

    expect(result.proceeded).toBe(true);
    expect(actionCalls).toBe(1);
    expect(promptCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it('aborts when dirty and user chooses cancel', async () => {
    let actionCalls = 0;
    let saveCalls = 0;
    let promptedFilePath: string | null = null;

    const store = createStore(baseDocument({ dirty: true, filePath: '/maps/dirty.json' }));

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async (options) => {
        promptedFilePath = options.filePath;
        return 'cancel';
      }
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        saveCalls += 1;
        return { ok: true, value: baseDocument({ dirty: false }) };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      actionCalls += 1;
    });

    expect(promptedFilePath).toBe('/maps/dirty.json');
    expect(result.proceeded).toBe(false);
    expect(actionCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it("proceeds without saving when dirty and user chooses don't-save", async () => {
    let actionCalls = 0;
    let saveCalls = 0;

    const store = createStore(baseDocument({ dirty: true }));

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async () => 'dont-save'
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        saveCalls += 1;
        return { ok: true, value: baseDocument({ dirty: false }) };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      actionCalls += 1;
    });

    expect(result.proceeded).toBe(true);
    expect(actionCalls).toBe(1);
    expect(saveCalls).toBe(0);
  });

  it('saves then proceeds when dirty and user chooses save and save succeeds', async () => {
    const events: string[] = [];

    const store = createStore(baseDocument({ dirty: true }));

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async () => {
        events.push('prompt');
        return 'save';
      }
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        events.push('save');
        return { ok: true, value: baseDocument({ dirty: false }) };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      events.push('action');
    });

    expect(result.proceeded).toBe(true);
    expect(events).toEqual(['prompt', 'save', 'action']);
  });

  it('aborts when dirty and user chooses save but save fails', async () => {
    const events: string[] = [];

    const store = createStore(baseDocument({ dirty: true }));

    const prompter: UserPrompter = {
      confirmUnsavedChanges: async () => {
        events.push('prompt');
        return 'save';
      }
    };

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => {
        events.push('save');
        return { ok: false, error: { kind: 'map-io-error', code: 'map-io/write-failed', message: 'nope' } };
      }
    } as unknown as SaveMapService;

    const guard = new UnsavedChangesGuard(store, prompter, saveMapService);

    const result = await guard.runGuarded(async () => {
      events.push('action');
    });

    expect(result.proceeded).toBe(false);
    expect(events).toEqual(['prompt', 'save']);
  });

});
