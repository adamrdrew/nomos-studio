import { useNomosStore } from './nomosStore';

import type { Result } from '../../shared/domain/results';
import type { AppStateSnapshot } from '../../shared/ipc/nomosIpc';

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
    const w = (globalThis as unknown as { window?: unknown }).window as { nomos?: unknown } | undefined;
    if (w && 'nomos' in w) {
      delete w.nomos;
    }
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
