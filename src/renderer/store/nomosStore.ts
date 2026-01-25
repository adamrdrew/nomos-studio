import { create } from 'zustand';

import type {
  AssetIndex,
  EditorSettings,
  MapDocument,
  MapDoorVisibility,
  MapGridSettings,
  MapRenderMode,
  MapSectorSurface
} from '../../shared/domain/models';
import type { RoomStamp } from '../../shared/domain/mapRoomStamp';
import type { MapEditHistoryInfo, MapEditSelectionEffect, MapEditTargetRef } from '../../shared/ipc/nomosIpc';
import type { MapSelection } from '../ui/editor/map/mapSelection';

export type NomosStoreState = {
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  recentMapPaths: readonly string[];
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapSectorSurface: MapSectorSurface;
  mapGridSettings: MapGridSettings;
  mapHighlightPortals: boolean;
  mapHighlightToggleWalls: boolean;
  mapDoorVisibility: MapDoorVisibility;
  mapHistory: MapEditHistoryInfo;
  mapSelection: MapSelection | null;
  isPickingPlayerStart: boolean;
  roomCloneBuffer: RoomStamp | null;
  refreshFromMain: () => Promise<void>;
  setMapSelection: (selection: MapSelection | null) => void;
  applyMapSelectionEffect: (effect: MapEditSelectionEffect) => void;
  setIsPickingPlayerStart: (value: boolean) => void;
  setRoomCloneBuffer: (buffer: RoomStamp | null) => void;
  clearRoomCloneBuffer: () => void;
};

function toMapSelection(ref: MapEditTargetRef): MapSelection {
  switch (ref.kind) {
    case 'map':
      return { kind: 'map' };
    case 'light':
    case 'particle':
    case 'entity':
      return { kind: ref.kind, index: ref.index };
    case 'door':
      return { kind: 'door', id: ref.id };
    case 'wall':
      return { kind: 'wall', index: ref.index };
    case 'sector':
      return { kind: 'sector', id: ref.id };
    default: {
      const neverRef: never = ref;
      return neverRef;
    }
  }
}

function selectionMatchesRef(selection: MapSelection | null, ref: MapEditTargetRef): boolean {
  if (selection === null) {
    return false;
  }

  if (selection.kind !== ref.kind) {
    return false;
  }

  switch (ref.kind) {
    case 'map':
      return selection.kind === 'map';
    case 'light':
    case 'particle':
    case 'entity':
      return 'index' in selection && selection.index === ref.index;
    case 'door':
      return 'id' in selection && selection.id === ref.id;
    case 'wall':
      return 'index' in selection && selection.index === ref.index;
    case 'sector':
      return 'id' in selection && selection.id === ref.id;
    default: {
      const neverRef: never = ref;
      return neverRef;
    }
  }
}

const defaultSettings: EditorSettings = {
  assetsDirPath: null,
  gameExecutablePath: null,
  defaultSky: null,
  defaultSoundfont: null,
  defaultBgmusic: null,
  defaultWallTex: null,
  defaultFloorTex: null,
  defaultCeilTex: null
};

export const useNomosStore = create<NomosStoreState>((set) => ({
  settings: defaultSettings,
  assetIndex: null,
  recentMapPaths: [],
  mapDocument: null,
  mapRenderMode: 'textured',
  mapSectorSurface: 'floor',
  mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
  mapHighlightPortals: false,
  mapHighlightToggleWalls: false,
  mapDoorVisibility: 'visible',
  mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 },
  mapSelection: null,
  isPickingPlayerStart: false,
  roomCloneBuffer: null,
  refreshFromMain: async () => {
    const snapshotResult = await window.nomos.state.getSnapshot();
    if (!snapshotResult.ok) {
      return;
    }

    set((state) => {
      const prevPath = state.mapDocument?.filePath ?? null;
      const nextPath = snapshotResult.value.mapDocument?.filePath ?? null;
      const shouldClearCloneBuffer = prevPath !== nextPath;

      return {
        settings: snapshotResult.value.settings,
        assetIndex: snapshotResult.value.assetIndex,
        recentMapPaths: snapshotResult.value.recentMapPaths,
        mapDocument: snapshotResult.value.mapDocument,
        mapRenderMode: snapshotResult.value.mapRenderMode,
        mapSectorSurface: snapshotResult.value.mapSectorSurface,
        mapGridSettings: snapshotResult.value.mapGridSettings,
        mapHighlightPortals: snapshotResult.value.mapHighlightPortals,
        mapHighlightToggleWalls: snapshotResult.value.mapHighlightToggleWalls,
        mapDoorVisibility: snapshotResult.value.mapDoorVisibility,
        mapHistory: snapshotResult.value.mapHistory,
        roomCloneBuffer: shouldClearCloneBuffer ? null : state.roomCloneBuffer
      };
    });
  },
  setMapSelection: (selection) => {
    set({ mapSelection: selection });
  },
  applyMapSelectionEffect: (effect) => {
    set((state) => {
      switch (effect.kind) {
        case 'map-edit/selection/keep':
          return {};
        case 'map-edit/selection/clear':
          return { mapSelection: null };
        case 'map-edit/selection/set':
          return { mapSelection: toMapSelection(effect.ref) };
        case 'map-edit/selection/remap': {
          if (!selectionMatchesRef(state.mapSelection, effect.from)) {
            return {};
          }
          return { mapSelection: toMapSelection(effect.to) };
        }
        default: {
          const neverEffect: never = effect;
          return neverEffect;
        }
      }
    });
  },
  setIsPickingPlayerStart: (value) => {
    set({ isPickingPlayerStart: value });
  },
  setRoomCloneBuffer: (buffer) => {
    set({ roomCloneBuffer: buffer });
  },
  clearRoomCloneBuffer: () => {
    set({ roomCloneBuffer: null });
  }
}));
