import type { IpcMainInvokeEvent } from 'electron';

import type { NOMOS_IPC_CHANNELS } from '../../shared/ipc/nomosIpc';
import type {
  OpenAssetRequest,
  OpenAssetResponse,
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

  validateMap: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
  openMap: (request: OpenMapRequest) => Promise<OpenMapResponse>;
  saveMap: () => Promise<SaveMapResponse>;

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

  ipcMain.handle(channels.mapValidate, async (_event, request: unknown) =>
    handlers.validateMap(request as ValidateMapRequest)
  );
  ipcMain.handle(channels.mapOpen, async (_event, request: unknown) =>
    handlers.openMap(request as OpenMapRequest)
  );
  ipcMain.handle(channels.mapSave, async () => handlers.saveMap());

  ipcMain.handle(channels.stateGet, async () => handlers.getStateSnapshot());
}
