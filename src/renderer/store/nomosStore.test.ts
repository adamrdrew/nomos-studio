jest.mock(
  'monaco-editor',
  () => ({
  editor: {
    createModel: jest.fn((text: string) => {
      let value = text;
      const listeners: Array<() => void> = [];

      const model = {
        dispose: jest.fn(),
        getValue: jest.fn(() => value),
        setValue: jest.fn((next: string) => {
          value = next;
          for (const listener of listeners) {
            listener();
          }
        }),
        onDidChangeContent: jest.fn((listener: () => void) => {
          listeners.push(listener);
          return { dispose: jest.fn() };
        })
      };

      return model;
    })
  }
  }),
  { virtual: true }
);

import * as monaco from 'monaco-editor';

import { useNomosStore } from './nomosStore';

import type { Result } from '../../shared/domain/results';
import type { AppStateSnapshot } from '../../shared/ipc/nomosIpc';

function clearMockedWindowNomos(): void {
  const w = (globalThis as unknown as { window?: unknown }).window as { nomos?: unknown } | undefined;
  if (w && 'nomos' in w) {
    delete w.nomos;
  }
}

describe('useNomosStore selection', () => {
  afterEach(() => {
    useNomosStore.setState({ mapSelection: null, isPickingPlayerStart: false });
  });

  it("defaults mapSectorSurface to 'floor'", () => {
    expect(useNomosStore.getState().mapSectorSurface).toBe('floor');
  });

  it('defaults mapSelection to null', () => {
    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('defaults isPickingPlayerStart to false and can be toggled', () => {
    expect(useNomosStore.getState().isPickingPlayerStart).toBe(false);

    useNomosStore.getState().setIsPickingPlayerStart(true);
    expect(useNomosStore.getState().isPickingPlayerStart).toBe(true);

    useNomosStore.getState().setIsPickingPlayerStart(false);
    expect(useNomosStore.getState().isPickingPlayerStart).toBe(false);
  });

  it('setMapSelection updates selection', () => {
    useNomosStore.getState().setMapSelection({ kind: 'wall', index: 3 });
    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'wall', index: 3 });

    useNomosStore.getState().setMapSelection(null);
    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('applyMapSelectionEffect keep preserves selection', () => {
    useNomosStore.getState().setMapSelection({ kind: 'door', id: 'd1' });

    useNomosStore.getState().applyMapSelectionEffect({ kind: 'map-edit/selection/keep' });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'door', id: 'd1' });
  });

  it('applyMapSelectionEffect clear sets selection to null', () => {
    useNomosStore.getState().setMapSelection({ kind: 'light', index: 2 });

    useNomosStore.getState().applyMapSelectionEffect({ kind: 'map-edit/selection/clear', reason: 'deleted' });

    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('applyMapSelectionEffect set sets selection to the target ref', () => {
    useNomosStore.getState().setMapSelection(null);

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/set',
      ref: { kind: 'entity', index: 7 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'entity', index: 7 });
  });

  it('applyMapSelectionEffect remap updates selection when it matches from', () => {
    useNomosStore.getState().setMapSelection({ kind: 'particle', index: 1 });

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/remap',
      from: { kind: 'particle', index: 1 },
      to: { kind: 'particle', index: 2 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'particle', index: 2 });
  });

  it('applyMapSelectionEffect remap does not change selection when it does not match from', () => {
    useNomosStore.getState().setMapSelection({ kind: 'particle', index: 3 });

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/remap',
      from: { kind: 'particle', index: 1 },
      to: { kind: 'particle', index: 2 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'particle', index: 3 });
  });
});

describe('useNomosStore roomCloneBuffer', () => {
  afterEach(() => {
    useNomosStore.setState({ roomCloneBuffer: null, mapDocument: null });
    // Avoid leaking mocked window state between tests (Jest env is Node, so we use globalThis.window).
    clearMockedWindowNomos();
  });

  it('defaults roomCloneBuffer to null and supports set/clear', () => {
    expect(useNomosStore.getState().roomCloneBuffer).toBeNull();

    useNomosStore.getState().setRoomCloneBuffer({
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ],
      wallProps: [
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      sectorProps: {
        floorZ: 0,
        floorZToggledPos: null,
        ceilZ: 4,
        floorTex: 'F.PNG',
        ceilTex: 'C.PNG',
        light: 1
      }
    });

    expect(useNomosStore.getState().roomCloneBuffer?.polygon).toHaveLength(3);

    useNomosStore.getState().clearRoomCloneBuffer();
    expect(useNomosStore.getState().roomCloneBuffer).toBeNull();
  });

  it('refreshFromMain clears roomCloneBuffer only when map filePath changes', async () => {
    const baseSnapshot: AppStateSnapshot = {
      settings: {
        assetsDirPath: null,
        gameExecutablePath: null,
        defaultSky: null,
        defaultSoundfont: null,
        defaultBgmusic: null,
        defaultWallTex: null,
        defaultFloorTex: null,
        defaultCeilTex: null
      },
      assetIndex: null,
      recentMapPaths: [],
      mapDocument: {
        filePath: '/maps/a.json',
        json: {},
        dirty: false,
        lastValidation: null,
        revision: 1
      },
      mapRenderMode: 'textured',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true },
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
    };

    const getSnapshot = jest.fn<Promise<Result<AppStateSnapshot, unknown>>, []>();
    (globalThis as unknown as { window: { nomos: { state: { getSnapshot: () => ReturnType<typeof getSnapshot> } } } }).window = {
      nomos: { state: { getSnapshot } }
    };

    useNomosStore.getState().setRoomCloneBuffer({
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ],
      wallProps: [
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      sectorProps: {
        floorZ: 0,
        floorZToggledPos: null,
        ceilZ: 4,
        floorTex: 'F.PNG',
        ceilTex: 'C.PNG',
        light: 1
      }
    });

    // First refresh establishes mapDocument and (because prevPath is null) clears the buffer.
    getSnapshot.mockResolvedValueOnce({ ok: true, value: baseSnapshot });
    await useNomosStore.getState().refreshFromMain();
    expect(useNomosStore.getState().mapDocument?.filePath).toBe('/maps/a.json');
    expect(useNomosStore.getState().roomCloneBuffer).toBeNull();

    // Set buffer again; refresh with same path should preserve.
    useNomosStore.getState().setRoomCloneBuffer({
      polygon: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 }
      ],
      wallProps: [
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          tex: 'W.PNG',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      sectorProps: {
        floorZ: 0,
        floorZToggledPos: null,
        ceilZ: 4,
        floorTex: 'F.PNG',
        ceilTex: 'C.PNG',
        light: 1
      }
    });

    getSnapshot.mockResolvedValueOnce({ ok: true, value: { ...baseSnapshot, mapDocument: { ...baseSnapshot.mapDocument!, revision: 2 } } });
    await useNomosStore.getState().refreshFromMain();
    expect(useNomosStore.getState().roomCloneBuffer?.polygon[1]).toEqual({ x: 2, y: 0 });

    // Refresh with a different filePath must clear.
    getSnapshot.mockResolvedValueOnce({
      ok: true,
      value: {
        ...baseSnapshot,
        mapDocument: { ...baseSnapshot.mapDocument!, filePath: '/maps/b.json', revision: 1 }
      }
    });
    await useNomosStore.getState().refreshFromMain();
    expect(useNomosStore.getState().mapDocument?.filePath).toBe('/maps/b.json');
    expect(useNomosStore.getState().roomCloneBuffer).toBeNull();
  });
});

describe('useNomosStore refreshFromMain', () => {
  afterEach(() => {
    useNomosStore.setState({ mapDocument: null, roomCloneBuffer: null, mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true } });

    clearMockedWindowNomos();
  });

  it('refreshFromMain applies mapGridSettings.isSnapToGridEnabled from the main snapshot', async () => {
    const snapshot: AppStateSnapshot = {
      settings: {
        assetsDirPath: null,
        gameExecutablePath: null,
        defaultSky: null,
        defaultSoundfont: null,
        defaultBgmusic: null,
        defaultWallTex: null,
        defaultFloorTex: null,
        defaultCeilTex: null
      },
      assetIndex: null,
      recentMapPaths: [],
      mapDocument: null,
      mapRenderMode: 'textured',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: false },
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
    };

    const getSnapshot = jest.fn<Promise<Result<AppStateSnapshot, unknown>>, []>();
    (globalThis as unknown as { window: { nomos: { state: { getSnapshot: () => ReturnType<typeof getSnapshot> } } } }).window = {
      nomos: { state: { getSnapshot } }
    };

    getSnapshot.mockResolvedValueOnce({ ok: true, value: snapshot });
    await useNomosStore.getState().refreshFromMain();

    expect(useNomosStore.getState().mapGridSettings.isSnapToGridEnabled).toBe(false);

    getSnapshot.mockResolvedValueOnce({ ok: true, value: { ...snapshot, mapGridSettings: { ...snapshot.mapGridSettings, isSnapToGridEnabled: true } } });
    await useNomosStore.getState().refreshFromMain();

    expect(useNomosStore.getState().mapGridSettings.isSnapToGridEnabled).toBe(true);
  });
});

describe('useNomosStore json editor tabs', () => {
  afterEach(() => {
    useNomosStore.setState({ activeEditorTabId: 'map', jsonEditorTabs: [], mapDocument: null });
    clearMockedWindowNomos();
    jest.mocked(monaco.editor.createModel).mockClear();
  });

  it('openJsonEditorTab ignores empty/whitespace relative paths', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [unknown]>();
    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('   ');

    expect(readJsonText).not.toHaveBeenCalled();
    expect(useNomosStore.getState().jsonEditorTabs).toHaveLength(0);
    expect(useNomosStore.getState().activeEditorTabId).toBe('map');
  });

  it('openJsonEditorTab opens a new tab and activates it', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('Config/settings.json');

    expect(readJsonText).toHaveBeenCalledWith({ relativePath: 'Config/settings.json' });
    expect(monaco.editor.createModel).toHaveBeenCalledWith('{"a":1}', 'json');
    expect(useNomosStore.getState().activeEditorTabId).toBe('json:Config/settings.json');
    expect(useNomosStore.getState().jsonEditorTabs).toHaveLength(1);
    expect(useNomosStore.getState().jsonEditorTabs[0]?.fileName).toBe('settings.json');
  });

  it('openJsonEditorTab focuses an existing tab without duplicating', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');
    await useNomosStore.getState().openJsonEditorTab('foo.json');

    expect(useNomosStore.getState().jsonEditorTabs).toHaveLength(1);
    expect(useNomosStore.getState().activeEditorTabId).toBe('json:foo.json');
  });

  it('openJsonEditorTab returns early when readJsonText fails', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: false, error: { code: 'read-asset/missing-settings' } });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');

    expect(useNomosStore.getState().jsonEditorTabs).toHaveLength(0);
    expect(monaco.editor.createModel).not.toHaveBeenCalled();
    expect(useNomosStore.getState().activeEditorTabId).toBe('map');
  });

  it('closeJsonEditorTab disposes the model and falls back to map when active', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');
    const tab = useNomosStore.getState().jsonEditorTabs[0];
    expect(tab).toBeDefined();

    useNomosStore.getState().closeJsonEditorTab('json:foo.json');

    expect(useNomosStore.getState().jsonEditorTabs).toHaveLength(0);
    expect(useNomosStore.getState().activeEditorTabId).toBe('map');
    const mockedModel = tab!.model as unknown as { dispose: jest.Mock };
    expect(mockedModel.dispose).toHaveBeenCalled();

    const mockedDisposable = tab!.contentChangeDisposable as unknown as { dispose: jest.Mock };
    expect(mockedDisposable.dispose).toHaveBeenCalled();
  });

  it('tracks json tab dirty state based on text changes vs lastSavedText', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText } } } }).window = {
      nomos: { assets: { readJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(false);

    const model = useNomosStore.getState().jsonEditorTabs[0]!.model as unknown as { setValue: (next: string) => void };
    model.setValue('{"a":2}');
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(true);

    model.setValue('{"a":1}');
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(false);
  });

  it('saveActiveEditorTab saves the map when the active tab is map', async () => {
    const save = jest.fn<Promise<Result<unknown, unknown>>, []>();
    save.mockResolvedValueOnce({ ok: true, value: {} });

    const getSnapshot = jest.fn<Promise<Result<AppStateSnapshot, unknown>>, []>();
    getSnapshot.mockResolvedValueOnce({
      ok: true,
      value: {
        settings: {
          assetsDirPath: null,
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
        assetIndex: null,
        recentMapPaths: [],
        mapDocument: null,
        mapRenderMode: 'textured',
        mapSectorSurface: 'floor',
        mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true },
        mapHighlightPortals: false,
        mapHighlightToggleWalls: false,
        mapDoorVisibility: 'visible',
        mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
      }
    });

    (globalThis as unknown as { window: { nomos: { map: { save: typeof save }; state: { getSnapshot: typeof getSnapshot } } } }).window = {
      nomos: { map: { save }, state: { getSnapshot } }
    };

    useNomosStore.setState({ activeEditorTabId: 'map' });
    await useNomosStore.getState().saveActiveEditorTab();

    expect(save).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('saveActiveEditorTab saves the active JSON tab and clears dirty on success', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    const writeJsonText = jest.fn<Promise<Result<null, unknown>>, [{ relativePath: string; text: string }]>();
    writeJsonText.mockResolvedValueOnce({ ok: true, value: null });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText; writeJsonText: typeof writeJsonText } } } }).window = {
      nomos: { assets: { readJsonText, writeJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');
    const model = useNomosStore.getState().jsonEditorTabs[0]!.model as unknown as { setValue: (next: string) => void };
    model.setValue('{"a":2}');
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(true);

    await useNomosStore.getState().saveActiveEditorTab();

    expect(writeJsonText).toHaveBeenCalledWith({ relativePath: 'foo.json', text: '{"a":2}' });
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(false);
    expect(useNomosStore.getState().jsonEditorTabs[0]?.lastSavedText).toBe('{"a":2}');
  });

  it('saveActiveEditorTab leaves JSON dirty state unchanged on write failure', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    const writeJsonText = jest.fn<Promise<Result<null, unknown>>, [{ relativePath: string; text: string }]>();
    writeJsonText.mockResolvedValueOnce({ ok: false, error: { code: 'write-asset/write-failed' } });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText; writeJsonText: typeof writeJsonText } } } }).window = {
      nomos: { assets: { readJsonText, writeJsonText } }
    };

    await useNomosStore.getState().openJsonEditorTab('foo.json');
    const model = useNomosStore.getState().jsonEditorTabs[0]!.model as unknown as { setValue: (next: string) => void };
    model.setValue('{"a":2}');
    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(true);

    await useNomosStore.getState().saveActiveEditorTab();

    expect(useNomosStore.getState().jsonEditorTabs[0]?.isDirty).toBe(true);
    expect(useNomosStore.getState().jsonEditorTabs[0]?.lastSavedText).toBe('{"a":1}');
  });

  it('saveAllEditorsAndRun saves dirty JSON tabs in relativePath order, then runs', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValue({ ok: true, value: '{"a":1}' });

    const writeJsonText = jest.fn<Promise<Result<null, unknown>>, [{ relativePath: string; text: string }]>();
    writeJsonText.mockResolvedValue({ ok: true, value: null });

    const saveAndRun = jest.fn<Promise<Result<null, unknown>>, []>();
    saveAndRun.mockResolvedValueOnce({ ok: true, value: null });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText; writeJsonText: typeof writeJsonText }; map: { saveAndRun: typeof saveAndRun } } } }).window = {
      nomos: { assets: { readJsonText, writeJsonText }, map: { saveAndRun } }
    };

    await useNomosStore.getState().openJsonEditorTab('b.json');
    await useNomosStore.getState().openJsonEditorTab('a.json');

    const modelB = useNomosStore.getState().jsonEditorTabs.find((t) => t.relativePath === 'b.json')!.model as unknown as { setValue: (next: string) => void };
    const modelA = useNomosStore.getState().jsonEditorTabs.find((t) => t.relativePath === 'a.json')!.model as unknown as { setValue: (next: string) => void };
    modelB.setValue('{"a":2}');
    modelA.setValue('{"a":3}');

    await useNomosStore.getState().saveAllEditorsAndRun();

    expect(writeJsonText).toHaveBeenCalledTimes(2);
    expect(writeJsonText.mock.calls[0]?.[0].relativePath).toBe('a.json');
    expect(writeJsonText.mock.calls[1]?.[0].relativePath).toBe('b.json');
    expect(saveAndRun).toHaveBeenCalledTimes(1);

    const tabA = useNomosStore.getState().jsonEditorTabs.find((t) => t.relativePath === 'a.json');
    const tabB = useNomosStore.getState().jsonEditorTabs.find((t) => t.relativePath === 'b.json');
    expect(tabA?.isDirty).toBe(false);
    expect(tabB?.isDirty).toBe(false);
    expect(tabA?.lastSavedText).toBe('{"a":3}');
    expect(tabB?.lastSavedText).toBe('{"a":2}');
  });

  it('saveAllEditorsAndRun aborts before run when a JSON write fails', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    const writeJsonText = jest.fn<Promise<Result<null, unknown>>, [{ relativePath: string; text: string }]>();
    writeJsonText.mockResolvedValueOnce({ ok: false, error: { code: 'write-asset/write-failed' } });

    const saveAndRun = jest.fn<Promise<Result<null, unknown>>, []>();

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText; writeJsonText: typeof writeJsonText }; map: { saveAndRun: typeof saveAndRun } } } }).window = {
      nomos: { assets: { readJsonText, writeJsonText }, map: { saveAndRun } }
    };

    await useNomosStore.getState().openJsonEditorTab('a.json');
    const modelA = useNomosStore.getState().jsonEditorTabs[0]!.model as unknown as { setValue: (next: string) => void };
    modelA.setValue('{"a":2}');

    await useNomosStore.getState().saveAllEditorsAndRun();

    expect(saveAndRun).not.toHaveBeenCalled();
  });

  it('saveAllEditorsAndRun saves the map first when it is dirty', async () => {
    const readJsonText = jest.fn<Promise<Result<string, unknown>>, [{ relativePath: string }]>();
    readJsonText.mockResolvedValueOnce({ ok: true, value: '{"a":1}' });

    const writeJsonText = jest.fn<Promise<Result<null, unknown>>, [{ relativePath: string; text: string }]>();
    writeJsonText.mockResolvedValueOnce({ ok: true, value: null });

    const save = jest.fn<Promise<Result<unknown, unknown>>, []>();
    save.mockResolvedValueOnce({ ok: true, value: {} });

    const getSnapshot = jest.fn<Promise<Result<AppStateSnapshot, unknown>>, []>();
    getSnapshot.mockResolvedValueOnce({
      ok: true,
      value: {
        settings: {
          assetsDirPath: null,
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
        assetIndex: null,
        recentMapPaths: [],
        mapDocument: {
          filePath: '/maps/a.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        },
        mapRenderMode: 'textured',
        mapSectorSurface: 'floor',
        mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true },
        mapHighlightPortals: false,
        mapHighlightToggleWalls: false,
        mapDoorVisibility: 'visible',
        mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
      }
    });

    const saveAndRun = jest.fn<Promise<Result<null, unknown>>, []>();
    saveAndRun.mockResolvedValueOnce({ ok: true, value: null });

    (globalThis as unknown as { window: { nomos: { assets: { readJsonText: typeof readJsonText; writeJsonText: typeof writeJsonText }; map: { save: typeof save; saveAndRun: typeof saveAndRun }; state: { getSnapshot: typeof getSnapshot } } } }).window = {
      nomos: { assets: { readJsonText, writeJsonText }, map: { save, saveAndRun }, state: { getSnapshot } }
    };

    useNomosStore.setState({
      mapDocument: {
        filePath: '/maps/a.json',
        json: {},
        dirty: true,
        lastValidation: null,
        revision: 1
      }
    });

    await useNomosStore.getState().openJsonEditorTab('a.json');
    const modelA = useNomosStore.getState().jsonEditorTabs[0]!.model as unknown as { setValue: (next: string) => void };
    modelA.setValue('{"a":2}');

    await useNomosStore.getState().saveAllEditorsAndRun();

    expect(save).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(saveAndRun).toHaveBeenCalledTimes(1);
  });
});
