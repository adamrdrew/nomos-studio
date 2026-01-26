import { create } from 'zustand';
import * as monaco from 'monaco-editor';

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

  activeEditorTabId: 'map' | `json:${string}`;
  jsonEditorTabs: readonly JsonEditorTab[];

  refreshFromMain: () => Promise<void>;
  setMapSelection: (selection: MapSelection | null) => void;
  applyMapSelectionEffect: (effect: MapEditSelectionEffect) => void;
  setIsPickingPlayerStart: (value: boolean) => void;
  setRoomCloneBuffer: (buffer: RoomStamp | null) => void;
  clearRoomCloneBuffer: () => void;

  openJsonEditorTab: (relativePath: string) => Promise<void>;
  closeJsonEditorTab: (tabId: `json:${string}`) => void;
  setActiveEditorTabId: (tabId: 'map' | `json:${string}`) => void;

  saveActiveEditorTab: () => Promise<void>;
  saveAllEditorsAndRun: () => Promise<void>;
};

export type JsonEditorTab = Readonly<{
  id: `json:${string}`;
  relativePath: string;
  fileName: string;
  model: monaco.editor.ITextModel;
  contentChangeDisposable: monaco.IDisposable;
  lastSavedText: string;
  isDirty: boolean;
}>;

function toJsonTabId(relativePath: string): `json:${string}` {
  return `json:${relativePath}`;
}

function toFileName(relativePath: string): string {
  const parts = relativePath.split('/');
  return parts[parts.length - 1] ?? relativePath;
}

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

export const useNomosStore = create<NomosStoreState>((set, get) => ({
  settings: defaultSettings,
  assetIndex: null,
  recentMapPaths: [],
  mapDocument: null,
  mapRenderMode: 'textured',
  mapSectorSurface: 'floor',
  mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true },
  mapHighlightPortals: false,
  mapHighlightToggleWalls: false,
  mapDoorVisibility: 'visible',
  mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 },
  mapSelection: null,
  isPickingPlayerStart: false,
  roomCloneBuffer: null,

  activeEditorTabId: 'map',
  jsonEditorTabs: [],

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
  },

  openJsonEditorTab: async (relativePath: string) => {
    const trimmed = relativePath.trim();
    if (trimmed.length === 0) {
      return;
    }

    const tabId = toJsonTabId(trimmed);

    const existing = get().jsonEditorTabs.find((tab) => tab.id === tabId);
    if (existing !== undefined) {
      set({ activeEditorTabId: tabId });
      return;
    }

    const readResult = await window.nomos.assets.readJsonText({ relativePath: trimmed });
    if (!readResult.ok) {
      return;
    }

    const initialText = readResult.value;
    const model = monaco.editor.createModel(initialText, 'json');

    const contentChangeDisposable = model.onDidChangeContent(() => {
      const currentText = model.getValue();

      set((state) => {
        const existingTab = state.jsonEditorTabs.find((candidate) => candidate.id === tabId);
        if (existingTab === undefined) {
          return {};
        }

        const nextIsDirty = currentText !== existingTab.lastSavedText;
        if (existingTab.isDirty === nextIsDirty) {
          return {};
        }

        return {
          jsonEditorTabs: state.jsonEditorTabs.map((candidate) =>
            candidate.id === tabId ? { ...candidate, isDirty: nextIsDirty } : candidate
          )
        };
      });
    });

    const tab: JsonEditorTab = {
      id: tabId,
      relativePath: trimmed,
      fileName: toFileName(trimmed),
      model,
      contentChangeDisposable,
      lastSavedText: initialText,
      isDirty: false
    };

    set((state) => {
      const alreadyOpen = state.jsonEditorTabs.some((candidate) => candidate.id === tabId);
      if (alreadyOpen) {
        contentChangeDisposable.dispose();
        model.dispose();
        return { activeEditorTabId: tabId };
      }

      return {
        jsonEditorTabs: [...state.jsonEditorTabs, tab],
        activeEditorTabId: tabId
      };
    });
  },

  closeJsonEditorTab: (tabId) => {
    set((state) => {
      const tab = state.jsonEditorTabs.find((candidate) => candidate.id === tabId);
      if (tab !== undefined) {
        try {
          tab.contentChangeDisposable.dispose();
          tab.model.dispose();
        } catch (_error: unknown) {
          // Best effort.
        }
      }

      const nextTabs = state.jsonEditorTabs.filter((candidate) => candidate.id !== tabId);
      const nextActive = state.activeEditorTabId === tabId ? ('map' as const) : state.activeEditorTabId;

      return { jsonEditorTabs: nextTabs, activeEditorTabId: nextActive };
    });
  },

  setActiveEditorTabId: (tabId) => {
    set({ activeEditorTabId: tabId });
  },

  saveActiveEditorTab: async () => {
    const state = get();

    if (state.activeEditorTabId === 'map') {
      const result = await window.nomos.map.save();
      if (!result.ok) {
        return;
      }
      await state.refreshFromMain();
      return;
    }

    const tab = state.jsonEditorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
    if (tab === undefined) {
      return;
    }

    const text = tab.model.getValue();
    const result = await window.nomos.assets.writeJsonText({ relativePath: tab.relativePath, text });
    if (!result.ok) {
      return;
    }

    set((current) => ({
      jsonEditorTabs: current.jsonEditorTabs.map((candidate) =>
        candidate.id === tab.id ? { ...candidate, lastSavedText: text, isDirty: false } : candidate
      )
    }));
  },

  saveAllEditorsAndRun: async () => {
    const initialState = get();

    const dirtyJsonTabs = [...initialState.jsonEditorTabs]
      .filter((tab) => tab.isDirty)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    for (const tab of dirtyJsonTabs) {
      const text = tab.model.getValue();
      const result = await window.nomos.assets.writeJsonText({ relativePath: tab.relativePath, text });
      if (!result.ok) {
        return;
      }

      set((current) => ({
        jsonEditorTabs: current.jsonEditorTabs.map((candidate) =>
          candidate.id === tab.id ? { ...candidate, lastSavedText: text, isDirty: false } : candidate
        )
      }));
    }

    const mapWasDirty = initialState.mapDocument?.dirty === true;
    if (mapWasDirty) {
      const saveResult = await window.nomos.map.save();
      if (!saveResult.ok) {
        return;
      }
      await initialState.refreshFromMain();
    }

    await window.nomos.map.saveAndRun();
  }
}));
