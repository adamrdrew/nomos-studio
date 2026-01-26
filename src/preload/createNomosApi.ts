import {
  NOMOS_IPC_CHANNELS,
  type MapEditRequest,
  type MapEditResponse,
  type MapRedoRequest,
  type MapRedoResponse,
  type MapUndoRequest,
  type MapUndoResponse,
  type NewMapResponse,
  type OpenAssetRequest,
  type OpenAssetResponse,
  type OpenMapDialogResponse,
  type OpenMapFromAssetsRequest,
  type OpenMapFromAssetsResponse,
  type OpenMapResponse,
  type PickDirectoryResponse,
  type PickFileResponse,
  type ReadAssetFileBytesRequest,
  type ReadAssetFileBytesResponse,
  type ReadAssetJsonTextRequest,
  type ReadAssetJsonTextResponse,
  type WriteAssetJsonTextRequest,
  type WriteAssetJsonTextResponse,
  type RefreshAssetIndexResponse,
  type SaveMapResponse,
  type SaveAndRunMapResponse,
  type SettingsGetResponse,
  type SettingsUpdateRequest,
  type SettingsUpdateResponse,
  type StateChangedPayload,
  type StateGetResponse,
  type ValidateMapRequest,
  type ValidateMapResponse
} from '../shared/ipc/nomosIpc';

export type IpcRendererLike = Readonly<{
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void;
}>;

export function createNomosApi(ipcRenderer: IpcRendererLike) {
  return {
    version: '0.0.0',
    menu: {
      onSaveRequested: (listener: () => void): (() => void) => {
        const handler = (): void => {
          listener();
        };

        ipcRenderer.on(NOMOS_IPC_CHANNELS.menuSaveRequested, handler);

        return () => {
          ipcRenderer.removeListener(NOMOS_IPC_CHANNELS.menuSaveRequested, handler);
        };
      },
      onSaveAndRunRequested: (listener: () => void): (() => void) => {
        const handler = (): void => {
          listener();
        };

        ipcRenderer.on(NOMOS_IPC_CHANNELS.menuSaveAndRunRequested, handler);

        return () => {
          ipcRenderer.removeListener(NOMOS_IPC_CHANNELS.menuSaveAndRunRequested, handler);
        };
      }
    },
    settings: {
      get: async (): Promise<SettingsGetResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.settingsGet) as never,
      update: async (updates: SettingsUpdateRequest): Promise<SettingsUpdateResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.settingsUpdate, updates) as never
    },
    dialogs: {
      pickDirectory: async (): Promise<PickDirectoryResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsPickDirectory) as never,
      pickFile: async (): Promise<PickFileResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsPickFile) as never,
      openMap: async (): Promise<OpenMapDialogResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.dialogsOpenMap) as never
    },
    assets: {
      refreshIndex: async (): Promise<RefreshAssetIndexResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsRefreshIndex) as never,
      open: async (request: OpenAssetRequest): Promise<OpenAssetResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsOpen, request) as never,
      readFileBytes: async (request: ReadAssetFileBytesRequest): Promise<ReadAssetFileBytesResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsReadFileBytes, request) as never,
      readJsonText: async (request: ReadAssetJsonTextRequest): Promise<ReadAssetJsonTextResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsReadJsonText, request) as never,
      writeJsonText: async (request: WriteAssetJsonTextRequest): Promise<WriteAssetJsonTextResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.assetsWriteJsonText, request) as never
    },
    map: {
      validate: async (request: ValidateMapRequest): Promise<ValidateMapResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapValidate, request) as never,
      new: async (): Promise<NewMapResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapNew) as never,
      open: async (request: { mapPath: string }): Promise<OpenMapResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapOpen, request) as never,
      openFromAssets: async (request: OpenMapFromAssetsRequest): Promise<OpenMapFromAssetsResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapOpenFromAssets, request) as never,
      save: async (): Promise<SaveMapResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapSave) as never,
      saveAndRun: async (): Promise<SaveAndRunMapResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapSaveAndRun) as never,
      edit: async (request: MapEditRequest): Promise<MapEditResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapEdit, request) as never,
      undo: async (request: MapUndoRequest): Promise<MapUndoResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapUndo, request) as never,
      redo: async (request: MapRedoRequest): Promise<MapRedoResponse> =>
        ipcRenderer.invoke(NOMOS_IPC_CHANNELS.mapRedo, request) as never
    },
    state: {
      getSnapshot: async (): Promise<StateGetResponse> => ipcRenderer.invoke(NOMOS_IPC_CHANNELS.stateGet) as never,
      onChanged: (listener: (payload?: StateChangedPayload) => void): (() => void) => {
        const handler = (_event: unknown, payload: unknown): void => {
          listener(payload as StateChangedPayload | undefined);
        };

        ipcRenderer.on(NOMOS_IPC_CHANNELS.stateChanged, handler);

        return () => {
          ipcRenderer.removeListener(NOMOS_IPC_CHANNELS.stateChanged, handler);
        };
      }
    }
  } as const;
}
