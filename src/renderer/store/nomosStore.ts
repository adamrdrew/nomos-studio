import { create } from 'zustand';

import type { AssetIndex, EditorSettings, MapDocument } from '../../shared/domain/models';

export type NomosStoreState = {
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  mapDocument: MapDocument | null;
  refreshFromMain: () => Promise<void>;
};

const defaultSettings: EditorSettings = {
  assetsDirPath: null,
  gameExecutablePath: null
};

export const useNomosStore = create<NomosStoreState>((set) => ({
  settings: defaultSettings,
  assetIndex: null,
  mapDocument: null,
  refreshFromMain: async () => {
    const snapshotResult = await window.nomos.state.getSnapshot();
    if (!snapshotResult.ok) {
      return;
    }

    set({
      settings: snapshotResult.value.settings,
      assetIndex: snapshotResult.value.assetIndex,
      mapDocument: snapshotResult.value.mapDocument
    });
  }
}));
