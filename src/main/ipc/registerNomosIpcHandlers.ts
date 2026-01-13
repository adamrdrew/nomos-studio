import type { IpcMainInvokeEvent } from 'electron';

import type { NOMOS_IPC_CHANNELS } from '../../shared/ipc/nomosIpc';
import type {
  MapEditRequest,
  MapEditResponse,
  MapRedoRequest,
  MapRedoResponse,
  MapUndoRequest,
  MapUndoResponse,
  OpenAssetRequest,
  OpenAssetResponse,
  ReadAssetFileBytesRequest,
  ReadAssetFileBytesResponse,
  OpenMapDialogResponse,
  OpenMapRequest,
  OpenMapResponse,
  PickDirectoryResponse,
  PickFileResponse,
  RefreshAssetIndexResponse,
  SaveMapResponse,
  SettingsGetResponse,
  SettingsUpdateRequest,
  SettingsUpdateResponse,
  StateGetResponse,
  ValidateMapRequest,
  ValidateMapResponse
} from '../../shared/ipc/nomosIpc';

export type IpcMainLike = Readonly<{
  handle: (
    channel: (typeof NOMOS_IPC_CHANNELS)[keyof typeof NOMOS_IPC_CHANNELS],
    handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ) => void;
}>;

export type NomosIpcHandlers = Readonly<{
  getSettings: () => Promise<SettingsGetResponse>;
  updateSettings: (updates: SettingsUpdateRequest) => Promise<SettingsUpdateResponse>;

  pickDirectory: () => Promise<PickDirectoryResponse>;
  pickFile: () => Promise<PickFileResponse>;
  openMapDialog: () => Promise<OpenMapDialogResponse>;

  refreshAssetIndex: () => Promise<RefreshAssetIndexResponse>;
  openAsset: (request: OpenAssetRequest) => Promise<OpenAssetResponse>;
  readAssetFileBytes: (request: ReadAssetFileBytesRequest) => Promise<ReadAssetFileBytesResponse>;

  validateMap: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
  openMap: (request: OpenMapRequest) => Promise<OpenMapResponse>;
  saveMap: () => Promise<SaveMapResponse>;
  editMap: (request: MapEditRequest) => Promise<MapEditResponse>;
  undoMap: (request: MapUndoRequest) => Promise<MapUndoResponse>;
  redoMap: (request: MapRedoRequest) => Promise<MapRedoResponse>;

  getStateSnapshot: () => Promise<StateGetResponse>;
}>;

export function registerNomosIpcHandlers(
  ipcMain: IpcMainLike,
  channels: typeof import('../../shared/ipc/nomosIpc').NOMOS_IPC_CHANNELS,
  handlers: NomosIpcHandlers
): void {
  ipcMain.handle(channels.settingsGet, async () => handlers.getSettings());
  ipcMain.handle(channels.settingsUpdate, async (_event, updates: unknown) =>
    handlers.updateSettings(updates as SettingsUpdateRequest)
  );

  ipcMain.handle(channels.dialogsPickDirectory, async () => handlers.pickDirectory());
  ipcMain.handle(channels.dialogsPickFile, async () => handlers.pickFile());
  ipcMain.handle(channels.dialogsOpenMap, async () => handlers.openMapDialog());

  ipcMain.handle(channels.assetsRefreshIndex, async () => handlers.refreshAssetIndex());
  ipcMain.handle(channels.assetsOpen, async (_event, request: unknown) =>
    handlers.openAsset(request as OpenAssetRequest)
  );
  ipcMain.handle(channels.assetsReadFileBytes, async (_event, request: unknown) =>
    handlers.readAssetFileBytes(request as ReadAssetFileBytesRequest)
  );

  ipcMain.handle(channels.mapValidate, async (_event, request: unknown) =>
    handlers.validateMap(request as ValidateMapRequest)
  );
  ipcMain.handle(channels.mapOpen, async (_event, request: unknown) =>
    handlers.openMap(request as OpenMapRequest)
  );
  ipcMain.handle(channels.mapSave, async () => handlers.saveMap());
  ipcMain.handle(channels.mapEdit, async (_event, request: unknown) =>
    handlers.editMap(request as MapEditRequest)
  );
  ipcMain.handle(channels.mapUndo, async (_event, request: unknown) =>
    handlers.undoMap((request ?? {}) as MapUndoRequest)
  );
  ipcMain.handle(channels.mapRedo, async (_event, request: unknown) =>
    handlers.redoMap((request ?? {}) as MapRedoRequest)
  );

  ipcMain.handle(channels.stateGet, async () => handlers.getStateSnapshot());
}
