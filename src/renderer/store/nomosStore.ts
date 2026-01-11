import { create } from 'zustand';

import type { AssetIndex, EditorSettings, MapDocument, MapGridSettings, MapRenderMode } from '../../shared/domain/models';
import type { MapSelection } from '../ui/editor/map/mapSelection';

export type NomosStoreState = {
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapGridSettings: MapGridSettings;
  mapSelection: MapSelection | null;
  refreshFromMain: () => Promise<void>;
  setMapSelection: (selection: MapSelection | null) => void;
};

const defaultSettings: EditorSettings = {
  assetsDirPath: null,
  gameExecutablePath: null
};

export const useNomosStore = create<NomosStoreState>((set) => ({
  settings: defaultSettings,
  assetIndex: null,
  mapDocument: null,
  mapRenderMode: 'wireframe',
  mapGridSettings: { isGridVisible: true, gridOpacity: 0.35 },
  mapSelection: null,
  refreshFromMain: async () => {
    const snapshotResult = await window.nomos.state.getSnapshot();
    if (!snapshotResult.ok) {
      return;
    }

    set({
      settings: snapshotResult.value.settings,
      assetIndex: snapshotResult.value.assetIndex,
      mapDocument: snapshotResult.value.mapDocument,
      mapRenderMode: snapshotResult.value.mapRenderMode,
      mapGridSettings: snapshotResult.value.mapGridSettings
    });
  },
  setMapSelection: (selection) => {
    set({ mapSelection: selection });
  }
}));
