import { AppStore } from '../store/AppStore';
import { CreateNewMapService } from './CreateNewMapService';

import type { NewMapDialogPort, RecentMapsPort, UnsavedChangesGuardPort } from './CreateNewMapService';
import type { MapEditHistoryPort } from './MapEditHistory';

describe('CreateNewMapService', () => {
  it('returns null and does nothing when guard does not proceed', async () => {
    const store = new AppStore();

    const dialog: NewMapDialogPort = {
      promptForNewMapPath: async () => ({ ok: true, value: '/maps/untitled.json' })
    };

    const history: MapEditHistoryPort = {
      clear: () => {
        throw new Error('should not be called');
      },
      onMapOpened: () => {},
      recordEdit: () => {},
      getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
      undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } }),
      redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } })
    };

    const recentMaps: RecentMapsPort = {
      bump: async () => {
        throw new Error('should not be called');
      }
    };

    const guard: UnsavedChangesGuardPort = {
      runGuarded: async () => ({ proceeded: false })
    };

    const service = new CreateNewMapService(store, dialog, history, recentMaps, guard);

    const result = await service.createNewMap();

    expect(result).toEqual({ ok: true, value: null });
    expect(store.getState().mapDocument).toBeNull();
    expect(store.getState().recentMapPaths).toEqual([]);
  });

  it('returns an error when the save dialog fails', async () => {
    const store = new AppStore();

    const dialog: NewMapDialogPort = {
      promptForNewMapPath: async () => ({ ok: false, error: { message: 'dialog failed' } })
    };

    let cleared = 0;
    const history: MapEditHistoryPort = {
      clear: () => {
        cleared += 1;
      },
      onMapOpened: () => {},
      recordEdit: () => {},
      getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
      undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } }),
      redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } })
    };

    const recentMaps: RecentMapsPort = {
      bump: async () => {
        throw new Error('should not be called');
      }
    };

    const guard: UnsavedChangesGuardPort = {
      runGuarded: async (action) => {
        await action();
        return { proceeded: true };
      }
    };

    const service = new CreateNewMapService(store, dialog, history, recentMaps, guard);

    const result = await service.createNewMap();

    expect(result).toEqual({ ok: false, error: { message: 'dialog failed' } });
    expect(cleared).toBe(0);
    expect(store.getState().mapDocument).toBeNull();
    expect(store.getState().recentMapPaths).toEqual([]);
  });

  it('returns null when the save dialog is cancelled', async () => {
    const store = new AppStore();

    const dialog: NewMapDialogPort = {
      promptForNewMapPath: async () => ({ ok: true, value: null })
    };

    let cleared = 0;
    const history: MapEditHistoryPort = {
      clear: () => {
        cleared += 1;
      },
      onMapOpened: () => {},
      recordEdit: () => {},
      getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
      undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } }),
      redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } })
    };

    const recentMaps: RecentMapsPort = {
      bump: async () => {
        throw new Error('should not be called');
      }
    };

    const guard: UnsavedChangesGuardPort = {
      runGuarded: async (action) => {
        await action();
        return { proceeded: true };
      }
    };

    const service = new CreateNewMapService(store, dialog, history, recentMaps, guard);

    const result = await service.createNewMap();

    expect(result).toEqual({ ok: true, value: null });
    expect(cleared).toBe(0);
    expect(store.getState().mapDocument).toBeNull();
    expect(store.getState().recentMapPaths).toEqual([]);
  });

  it('creates a new map document when a destination path is chosen', async () => {
    const store = new AppStore();

    const dialog: NewMapDialogPort = {
      promptForNewMapPath: async () => ({ ok: true, value: '/maps/new.json' })
    };

    let cleared = 0;
    const history: MapEditHistoryPort = {
      clear: () => {
        cleared += 1;
      },
      onMapOpened: () => {},
      recordEdit: () => {},
      getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
      undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } }),
      redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } })
    };

    const recentMaps: RecentMapsPort = {
      bump: async (mapPath) => [mapPath]
    };

    const guard: UnsavedChangesGuardPort = {
      runGuarded: async (action) => {
        await action();
        return { proceeded: true };
      }
    };

    const service = new CreateNewMapService(store, dialog, history, recentMaps, guard);

    const result = await service.createNewMap();

    expect(result.ok).toBe(true);
    expect(result.ok && result.value?.filePath).toBe('/maps/new.json');
    expect(cleared).toBe(1);

    const document = store.getState().mapDocument;
    expect(document?.filePath).toBe('/maps/new.json');
    expect(document?.dirty).toBe(true);
    expect(document?.lastValidation).toBeNull();
    expect(document?.revision).toBe(1);

    expect(store.getState().recentMapPaths).toEqual(['/maps/new.json']);

    expect(document?.json).toEqual({
      vertices: [],
      sectors: [],
      walls: [],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    });
  });

  it('applies map-level default assets when creating a new map', async () => {
    const store = new AppStore();

    store.setSettings({
      ...store.getState().settings,
      defaultSky: 'day.png',
      defaultSoundfont: 'soundfont.sf2',
      defaultBgmusic: 'track.mid'
    });

    const dialog: NewMapDialogPort = {
      promptForNewMapPath: async () => ({ ok: true, value: '/maps/new.json' })
    };

    const history: MapEditHistoryPort = {
      clear: () => {},
      onMapOpened: () => {},
      recordEdit: () => {},
      getInfo: () => ({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }),
      undo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } }),
      redo: () => ({ ok: false, error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' } })
    };

    const recentMaps: RecentMapsPort = {
      bump: async (mapPath) => [mapPath]
    };

    const guard: UnsavedChangesGuardPort = {
      runGuarded: async (action) => {
        await action();
        return { proceeded: true };
      }
    };

    const service = new CreateNewMapService(store, dialog, history, recentMaps, guard);

    const result = await service.createNewMap();

    expect(result.ok).toBe(true);

    const document = store.getState().mapDocument;
    expect(document?.json).toEqual({
      sky: 'day.png',
      soundfont: 'soundfont.sf2',
      bgmusic: 'track.mid',
      vertices: [],
      sectors: [],
      walls: [],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    });
  });
});
