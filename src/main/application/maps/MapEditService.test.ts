import { MapEditService } from './MapEditService';
import { MapCommandEngine } from './MapCommandEngine';
import { MapEditHistory } from './MapEditHistory';
import type { AppStore } from '../store/AppStore';
import type { MapDocument, MapValidationRecord } from '../../../shared/domain/models';

type StoredMapDocument = Readonly<{ dirty: boolean; json: unknown }>;

function baseMapJson(): Record<string, unknown> {
  return {
    vertices: [],
    sectors: [],
    walls: [],
    doors: [],
    lights: [],
    particles: [],
    entities: []
  };
}

function createService(store: AppStore): MapEditService {
  return new MapEditService(store, new MapCommandEngine(), new MapEditHistory(100));
}

function createMutableStore(initialDocument: MapDocument | null): Readonly<{
  store: AppStore;
  getDocument: () => MapDocument | null;
  setCalls: readonly (MapDocument | null)[];
}> {
  let mapDocument: MapDocument | null = initialDocument;
  const setCalls: (MapDocument | null)[] = [];

  const store: AppStore = {
    getState: () => ({
      settings: { assetsDirPath: null, gameExecutablePath: null },
      assetIndex: null,
      assetIndexError: null,
      mapDocument
    }),
    subscribe: () => () => {},
    setSettings: () => {},
    setAssetIndex: () => {},
    setAssetIndexError: () => {},
    setMapDocument: (next: MapDocument | null) => {
      mapDocument = next;
      setCalls.push(next);
    }
  } as unknown as AppStore;

  return {
    store,
    getDocument: () => mapDocument,
    setCalls
  };
}

describe('MapEditService', () => {
  it('undo returns no-document when no map is loaded', () => {
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

    const service = createService(store);

    const result = service.undo();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/no-document');
    }
  });

  it('redo returns no-document when no map is loaded', () => {
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

    const service = createService(store);

    const result = service.redo();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/no-document');
    }
  });

  it('undo returns not-found when there is no history', () => {
    const { store } = createMutableStore({
      filePath: '/maps/test.json',
      json: { ...baseMapJson() },
      dirty: false,
      lastValidation: null
    });

    const service = createService(store);

    const result = service.undo();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('redo returns not-found when there is no history', () => {
    const { store } = createMutableStore({
      filePath: '/maps/test.json',
      json: { ...baseMapJson() },
      dirty: false,
      lastValidation: null
    });

    const service = createService(store);

    const result = service.redo();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('undo restores json + dirty + lastValidation and returns selection/history info', () => {
    const lastValidation: MapValidationRecord = { ok: true, validatedAtIso: '2020-01-01T00:00:00.000Z' };

    const { store, getDocument } = createMutableStore({
      filePath: '/maps/test.json',
      json: {
        ...baseMapJson(),
        lights: [{ x: 1, y: 2, radius: 3, intensity: 1, color: '#ffffff' }]
      },
      dirty: false,
      lastValidation
    });

    const service = createService(store);

    const editResult = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });
    expect(editResult.ok).toBe(true);

    const undoResult = service.undo({ steps: 0 });
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) {
      throw new Error('Expected undo to succeed');
    }

    expect(undoResult.value.kind).toBe('map-edit/applied');
    if (undoResult.value.kind === 'map-edit/applied') {
      expect(undoResult.value.selection.kind).toBe('map-edit/selection/set');
      expect(undoResult.value.history.canRedo).toBe(true);
    }

    const docAfterUndo = getDocument();
    expect(docAfterUndo).not.toBeNull();
    if (docAfterUndo === null) {
      throw new Error('Expected document after undo');
    }

    expect(docAfterUndo.dirty).toBe(false);
    expect(docAfterUndo.lastValidation).toEqual(lastValidation);
    const json = docAfterUndo.json as Record<string, unknown>;
    expect(Array.isArray(json['lights'])).toBe(true);
    expect((json['lights'] as unknown[])).toHaveLength(1);
  });

  it('redo reapplies json + dirty + lastValidation after an undo', () => {
    const lastValidation: MapValidationRecord = { ok: true, validatedAtIso: '2020-01-01T00:00:00.000Z' };

    const { store, getDocument } = createMutableStore({
      filePath: '/maps/test.json',
      json: {
        ...baseMapJson(),
        lights: [{ x: 1, y: 2, radius: 3, intensity: 1, color: '#ffffff' }]
      },
      dirty: false,
      lastValidation
    });

    const service = createService(store);

    const editResult = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });
    expect(editResult.ok).toBe(true);

    const undoResult = service.undo();
    expect(undoResult.ok).toBe(true);

    const redoResult = service.redo();
    expect(redoResult.ok).toBe(true);
    if (!redoResult.ok) {
      throw new Error('Expected redo to succeed');
    }

    expect(redoResult.value.kind).toBe('map-edit/applied');
    if (redoResult.value.kind === 'map-edit/applied') {
      expect(redoResult.value.selection.kind).toBe('map-edit/selection/clear');
      expect(redoResult.value.history.canUndo).toBe(true);
    }

    const docAfterRedo = getDocument();
    expect(docAfterRedo).not.toBeNull();
    if (docAfterRedo === null) {
      throw new Error('Expected document after redo');
    }

    expect(docAfterRedo.dirty).toBe(true);
    expect(docAfterRedo.lastValidation).toBeNull();
    const json = docAfterRedo.json as Record<string, unknown>;
    expect(Array.isArray(json['lights'])).toBe(true);
    expect((json['lights'] as unknown[])).toHaveLength(0);
  });

  it('clears redo after a new edit following undo', () => {
    const { store } = createMutableStore({
      filePath: '/maps/test.json',
      json: {
        ...baseMapJson(),
        lights: [
          { x: 1, y: 2, radius: 3, intensity: 1, color: '#ffffff' },
          { x: 9, y: 9, radius: 3, intensity: 1, color: '#ffffff' }
        ]
      },
      dirty: false,
      lastValidation: null
    });

    const service = createService(store);

    const firstDelete = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });
    expect(firstDelete.ok).toBe(true);

    const undo = service.undo();
    expect(undo.ok).toBe(true);

    const secondDelete = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });
    expect(secondDelete.ok).toBe(true);

    const redo = service.redo();
    expect(redo.ok).toBe(false);
    if (!redo.ok) {
      expect(redo.error.code).toBe('map-edit/not-found');
    }
  });

  it('applies a successful transaction atomically and returns map-edit/applied', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            entities: [{ x: 10, y: 20, type: 'enemy' }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({
      kind: 'map-edit/transaction',
      label: 'Clone Entity',
      commands: [{ kind: 'map-edit/clone', target: { kind: 'entity', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'entity', index: 0 } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected transaction to succeed');
    }

    expect(result.value.kind).toBe('map-edit/applied');
    if (result.value.kind === 'map-edit/applied') {
      expect(result.value.selection.kind).toBe('map-edit/selection/set');
      expect(result.value.history.canUndo).toBe(true);
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const storedJson = (storedDocument as unknown as { json: unknown }).json as Record<string, unknown>;
    expect(Array.isArray(storedJson['entities'])).toBe(true);
    expect((storedJson['entities'] as unknown[])).toHaveLength(2);
  });

  it('does not mutate store when a transaction step fails', () => {
    const initialJson = {
      ...baseMapJson(),
      lights: [{ x: 1, y: 2, radius: 3, intensity: 1, color: '#ffffff' }]
    };

    const { store, getDocument, setCalls } = createMutableStore({
      filePath: '/maps/test.json',
      json: initialJson,
      dirty: false,
      lastValidation: null
    });

    const service = createService(store);

    const result = service.edit({
      kind: 'map-edit/transaction',
      commands: [
        { kind: 'map-edit/delete', target: { kind: 'light', index: 0 } },
        { kind: 'map-edit/delete', target: { kind: 'light', index: 99 } }
      ]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/transaction-step-failed');
      expect(result.error.stepIndex).toBe(1);
    }

    expect(setCalls).toHaveLength(0);
    const after = getDocument();
    expect(after).not.toBeNull();
    if (after !== null) {
      expect(after.json).toEqual(initialJson);
    }
  });

  it('returns no-document when no map is loaded', () => {
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

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/no-document');
    }
  });

  it('returns invalid-json when current document JSON is not an object', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: 'not-an-object',
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns unsupported-target when command kind is unknown', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson() },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/unknown', target: null } as unknown as Parameters<MapEditService['edit']>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/unsupported-target');
    }
  });

  it('returns unsupported-target when target kind is unknown (delete)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson() },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({
      kind: 'map-edit/delete',
      target: { kind: 'wall', index: 0 }
    } as unknown as Parameters<MapEditService['edit']>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/unsupported-target');
    }
  });

  it('returns unsupported-target when target kind is unknown (clone)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson() },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({
      kind: 'map-edit/clone',
      target: { kind: 'sector', index: 0 }
    } as unknown as Parameters<MapEditService['edit']>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/unsupported-target');
    }
  });

  it('deletes a light by index and marks the document dirty', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            lights: [{ x: 1, y: 2, radius: 3, intensity: 1, color: '#ffffff' }, { x: 9, y: 9, radius: 3, intensity: 1, color: '#ffffff' }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    expect(stored.dirty).toBe(true);
    const storedJson = stored.json as Record<string, unknown>;
    expect(Array.isArray(storedJson['lights'])).toBe(true);
    expect((storedJson['lights'] as unknown[])).toHaveLength(1);
  });

  it('returns not-found when deleting an out-of-range indexed target', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), lights: [] },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 5 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('clones an entity by index with a +16,+16 offset and returns the new ref', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            entities: [{ x: 10, y: 20, yaw_deg: 90, def: 'player' }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'entity', index: 0 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe('map-edit/cloned');
      if (result.value.kind === 'map-edit/cloned') {
        expect(result.value.newRef).toEqual({ kind: 'entity', index: 1 });
      }
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    expect(stored.dirty).toBe(true);
    const storedJson = stored.json as Record<string, unknown>;
    const entities = storedJson['entities'] as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    expect(entities[1]).toEqual({ x: 26, y: 36, yaw_deg: 90, def: 'player' });
  });

  it('clones a door by id and generates a unique id with collision checks', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [
              { id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false },
              { id: 'door-1-copy', wall_index: 1, tex: 'door.png', starts_closed: false }
            ]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ kind: 'map-edit/cloned', newRef: { kind: 'door', id: 'door-1-copy-2' } });
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { json: unknown };
    const storedJson = stored.json as Record<string, unknown>;
    const doors = storedJson['doors'] as Array<Record<string, unknown>>;
    expect(doors).toHaveLength(3);
    expect(doors[2]).toEqual({ id: 'door-1-copy-2', wall_index: 0, tex: 'door.png', starts_closed: false });
  });

  it('returns invalid-json when cloning a particle with invalid x/y', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            particles: [{ x: 'nope', y: 5 }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'particle', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('deletes a door by id', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [
              { id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false },
              { id: 'door-2', wall_index: 1, tex: 'door.png', starts_closed: false }
            ]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { json: unknown };
    const storedJson = stored.json as Record<string, unknown>;
    const doors = storedJson['doors'] as Array<Record<string, unknown>>;
    expect(doors).toHaveLength(1);
    expect(doors[0]).toEqual({ id: 'door-2', wall_index: 1, tex: 'door.png', starts_closed: false });
  });

  it('returns not-found when deleting a door id that does not exist', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'door', id: 'missing-door' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('clones a light by index with a +16,+16 offset', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            lights: [{ x: 5, y: 6, radius: 3, intensity: 1, color: '#ffffff' }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'light', index: 0 } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }
    const stored = storedDocument as unknown as { json: unknown };
    const storedJson = stored.json as Record<string, unknown>;
    const lights = storedJson['lights'] as Array<Record<string, unknown>>;
    expect(lights).toHaveLength(2);
    expect(lights[1]).toEqual({ x: 21, y: 22, radius: 3, intensity: 1, color: '#ffffff' });
  });

  it('returns invalid-json when an expected collection is not an array', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), lights: 'not-an-array' },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns not-found when cloning a door id that does not exist (even if other door entries are malformed)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [{ id: null, wall_index: 0, tex: 'door.png', starts_closed: false }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('deletes a particle by index and marks the document dirty', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            particles: [{ x: 1, y: 2 }, { x: 9, y: 9 }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'particle', index: 0 } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    expect(stored.dirty).toBe(true);
    const storedJson = stored.json as Record<string, unknown>;
    expect((storedJson['particles'] as unknown[])).toHaveLength(1);
  });

  it('deletes an entity by index and marks the document dirty', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            entities: [{ x: 1, y: 2, yaw_deg: 0, def: 'a' }, { x: 9, y: 9, yaw_deg: 0, def: 'b' }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'entity', index: 0 } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    expect(stored.dirty).toBe(true);
    const storedJson = stored.json as Record<string, unknown>;
    expect((storedJson['entities'] as unknown[])).toHaveLength(1);
  });

  it('clones a particle by index with a +16,+16 offset and returns the new ref', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            particles: [{ x: 10, y: 20 }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'particle', index: 0 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ kind: 'map-edit/cloned', newRef: { kind: 'particle', index: 1 } });
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    const storedJson = stored.json as Record<string, unknown>;
    const particles = storedJson['particles'] as Array<Record<string, unknown>>;
    expect(particles).toHaveLength(2);
    expect(particles[1]).toEqual({ x: 26, y: 36 });
  });

  it('returns not-found when deleting a negative index target', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), lights: [{ x: 1, y: 2 }] },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'light', index: -1 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('returns not-found when cloning a non-integer index target', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), entities: [{ x: 1, y: 2, yaw_deg: 0, def: 'a' }] },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({
      kind: 'map-edit/clone',
      target: { kind: 'entity', index: 0.5 as unknown as number }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('clones a door by id and uses the base "-copy" suffix when available', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ kind: 'map-edit/cloned', newRef: { kind: 'door', id: 'door-1-copy' } });
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const stored = storedDocument as unknown as { dirty: boolean; json: unknown };
    const storedJson = stored.json as Record<string, unknown>;
    const doors = storedJson['doors'] as Array<Record<string, unknown>>;
    expect(doors).toHaveLength(2);
    expect(doors[1]?.['id']).toBe('door-1-copy');
  });

  it('returns invalid-json when cloning a door whose id is empty/whitespace', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [{ id: '   ', wall_index: 0, tex: 'door.png', starts_closed: false }]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: '   ' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns invalid-json when cloning an indexed target but the expected collection is not an array', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), particles: 'not-an-array' },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'particle', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns not-found when cloning an indexed target with an out-of-range index (source undefined)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), entities: [] },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'entity', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/not-found');
    }
  });

  it('returns invalid-json when cloning an indexed target whose entry is not an object', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), entities: [123] },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'entity', index: 0 } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns invalid-json when doors is not an array (delete)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), doors: 'not-an-array' },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('returns invalid-json when doors is not an array (clone)', () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { ...baseMapJson(), doors: 'not-an-array' },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-edit/invalid-json');
    }
  });

  it('deletes a door by id even if the doors array contains non-record entries', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [
              123,
              { id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false },
              { id: 'door-2', wall_index: 1, tex: 'door.png', starts_closed: false }
            ]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/delete', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(true);
    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const storedJson = (storedDocument as unknown as { json: unknown }).json as Record<string, unknown>;
    const doors = storedJson['doors'] as unknown[];
    expect(doors).toHaveLength(2);
    expect(doors).toEqual([123, { id: 'door-2', wall_index: 1, tex: 'door.png', starts_closed: false }]);
  });

  it('clones a door by id even if the doors array contains non-record entries, and handles multi-collision id generation', () => {
    let storedDocument: StoredMapDocument | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            ...baseMapJson(),
            doors: [
              123,
              { id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false },
              { id: 'door-1-copy', wall_index: 1, tex: 'door.png', starts_closed: false },
              { id: 'door-1-copy-2', wall_index: 2, tex: 'door.png', starts_closed: false }
            ]
          },
          dirty: false,
          lastValidation: null
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: unknown) => {
        storedDocument = doc as StoredMapDocument | null;
      }
    } as unknown as AppStore;

    const service = createService(store);

    const result = service.edit({ kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ kind: 'map-edit/cloned', newRef: { kind: 'door', id: 'door-1-copy-3' } });
    }

    expect(storedDocument).not.toBeNull();
    if (storedDocument === null) {
      throw new Error('Expected MapEditService to store an updated document');
    }

    const storedJson = (storedDocument as unknown as { json: unknown }).json as Record<string, unknown>;
    const doors = storedJson['doors'] as unknown[];
    expect(doors).toHaveLength(5);
    expect((doors[4] as Record<string, unknown>)['id']).toBe('door-1-copy-3');
  });
});
