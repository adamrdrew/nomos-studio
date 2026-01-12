import { contextBridge, ipcRenderer } from 'electron';

import {
  NOMOS_IPC_CHANNELS,
  type MapEditRequest,
  type MapEditResponse,
  type OpenAssetRequest,
  type OpenAssetResponse,
  type ReadAssetFileBytesRequest,
  type ReadAssetFileBytesResponse,
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
  type ValidateMapRequest,
  type ValidateMapResponse
} from '../shared/ipc/nomosIpc';

const exposedNomosApi = {
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
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsRefreshIndex),
    open: async (request: OpenAssetRequest): Promise<OpenAssetResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsOpen, request),
    readFileBytes: async (request: ReadAssetFileBytesRequest): Promise<ReadAssetFileBytesResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsReadFileBytes, request)
  },
  map: {
    validate: async (request: ValidateMapRequest): Promise<ValidateMapResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapValidate, request),
    open: async (request: { mapPath: string }): Promise<OpenMapResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapOpen, request),
    save: async (): Promise<SaveMapResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapSave),
    edit: async (request: MapEditRequest): Promise<MapEditResponse> =>
      ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapEdit, request)
  },
  state: {
    getSnapshot: async (): Promise<StateGetResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.stateGet),
    onChanged: (listener: () => void): (() => void) => {
      const handler = (): void => {
        listener();
      };

      ipcRenderer.on(NOMOS_IPC_CHANNELS.stateChanged, handler);

      return () => {
        ipcRenderer.removeListener(NOMOS_IPC_CHANNELS.stateChanged, handler);
      };
    }
  }
} as const;

try {
  contextBridge.exposeInMainWorld('nomos', exposedNomosApi);
} catch (error: unknown) {
  // eslint-disable-next-line no-console
  console.error('[preload] exposeInMainWorld failed:', error);
}
