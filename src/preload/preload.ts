import { contextBridge, ipcRenderer } from 'electron';

import {
  NOMOS_IPC_CHANNELS,
  NOMOS_IPC_EVENTS,
  type OpenMapDialogResponse,
  type OpenMapResponse,
  type PickDirectoryResponse,
  type PickFileResponse,
  type RefreshAssetIndexResponse,
  type SaveMapResponse,
  type SettingsGetResponse,
  type SettingsUpdateRequest,
  type SettingsUpdateResponse,
  type StateGetResponse,
  type Unsubscribe,
  type ValidateMapRequest,
  type ValidateMapResponse
} from '../shared/ipc/nomosIpc';

contextBridge.exposeInMainWorld('nomos', {
  version: '0.0.0',
  settings: {
    get: async (): Promise<SettingsGetResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.settingsGet),
    update: async (updates: SettingsUpdateRequest): Promise<SettingsUpdateResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.settingsUpdate, updates)
  },
  dialogs: {
    pickDirectory: async (): Promise<PickDirectoryResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsPickDirectory),
    pickFile: async (): Promise<PickFileResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsPickFile),
    openMap: async (): Promise<OpenMapDialogResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsOpenMap)
  },
  assets: {
    refreshIndex: async (): Promise<RefreshAssetIndexResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsRefreshIndex)
  },
  map: {
    validate: async (request: ValidateMapRequest): Promise<ValidateMapResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapValidate, request),
    open: async (request: { mapPath: string }): Promise<OpenMapResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapOpen, request),
    save: async (): Promise<SaveMapResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapSave)
  },
  state: {
    getSnapshot: async (): Promise<StateGetResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.stateGet)
  },
  events: {
    onOpenSettings: (listener: () => void): Unsubscribe => {
      const handler = (): void => {
        listener();
      };
      ipcRenderer.on(NOMOS_IPC_EVENTS.uiOpenSettings, handler);
      return () => {
        ipcRenderer.removeListener(NOMOS_IPC_EVENTS.uiOpenSettings, handler);
      };
    }
  }
});
