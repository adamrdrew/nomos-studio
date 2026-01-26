import type { IpcMainInvokeEvent } from 'electron';

import type { NOMOS_IPC_CHANNELS } from '../../shared/ipc/nomosIpc';
import type { MapEditError } from '../../shared/domain/results';
import type {
  MapEditRequest,
  MapEditResponse,
  MapRedoRequest,
  MapRedoResponse,
  MapUndoRequest,
  MapUndoResponse,
  NewMapResponse,
  OpenAssetRequest,
  OpenAssetResponse,
  OpenMapFromAssetsRequest,
  OpenMapFromAssetsResponse,
  ReadAssetFileBytesRequest,
  ReadAssetFileBytesResponse,
  ReadAssetJsonTextRequest,
  ReadAssetJsonTextResponse,
  WriteAssetJsonTextRequest,
  WriteAssetJsonTextResponse,
  OpenMapDialogResponse,
  OpenMapRequest,
  OpenMapResponse,
  PickDirectoryResponse,
  PickFileResponse,
  RefreshAssetIndexResponse,
  SaveMapResponse,
  SaveAndRunMapResponse,
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
  readAssetJsonText: (request: ReadAssetJsonTextRequest) => Promise<ReadAssetJsonTextResponse>;
  writeAssetJsonText: (request: WriteAssetJsonTextRequest) => Promise<WriteAssetJsonTextResponse>;

  validateMap: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
  newMap: () => Promise<NewMapResponse>;
  openMap: (request: OpenMapRequest) => Promise<OpenMapResponse>;
  openMapFromAssets: (request: OpenMapFromAssetsRequest) => Promise<OpenMapFromAssetsResponse>;
  saveMap: () => Promise<SaveMapResponse>;
  saveAndRunMap: () => Promise<SaveAndRunMapResponse>;
  editMap: (request: MapEditRequest) => Promise<MapEditResponse>;
  undoMap: (request: MapUndoRequest) => Promise<MapUndoResponse>;
  redoMap: (request: MapRedoRequest) => Promise<MapRedoResponse>;

  getStateSnapshot: () => Promise<StateGetResponse>;
}>;

function badMapEditRequest(message: string): Readonly<{ ok: false; error: MapEditError }> {
  return {
    ok: false,
    error: {
      kind: 'map-edit-error',
      code: 'map-edit/invalid-json',
      message
    }
  };
}

function badReadAssetJsonTextRequest(message: string): ReadAssetJsonTextResponse {
  return {
    ok: false,
    error: {
      kind: 'read-asset-error',
      code: 'read-asset/invalid-relative-path',
      message
    }
  };
}

function badWriteAssetJsonTextRequest(message: string): WriteAssetJsonTextResponse {
  return {
    ok: false,
    error: {
      kind: 'write-asset-error',
      code: 'write-asset/invalid-relative-path',
      message
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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
  ipcMain.handle(channels.assetsReadJsonText, async (_event, request: unknown) =>
    isRecord(request) && isString(request['relativePath'])
      ? handlers.readAssetJsonText(request as ReadAssetJsonTextRequest)
      : badReadAssetJsonTextRequest('Invalid read JSON request.')
  );
  ipcMain.handle(channels.assetsWriteJsonText, async (_event, request: unknown) =>
    isRecord(request) && isString(request['relativePath']) && isString(request['text'])
      ? handlers.writeAssetJsonText(request as WriteAssetJsonTextRequest)
      : badWriteAssetJsonTextRequest('Invalid write JSON request.')
  );

  ipcMain.handle(channels.mapValidate, async (_event, request: unknown) =>
    handlers.validateMap(request as ValidateMapRequest)
  );
  ipcMain.handle(channels.mapNew, async () => handlers.newMap());
  ipcMain.handle(channels.mapOpen, async (_event, request: unknown) =>
    handlers.openMap(request as OpenMapRequest)
  );
  ipcMain.handle(channels.mapOpenFromAssets, async (_event, request: unknown) =>
    handlers.openMapFromAssets(request as OpenMapFromAssetsRequest)
  );
  ipcMain.handle(channels.mapSave, async () => handlers.saveMap());
  ipcMain.handle(channels.mapSaveAndRun, async () => handlers.saveAndRunMap());
  ipcMain.handle(channels.mapEdit, async (_event, request: unknown) =>
    isRecord(request) && isFiniteNumber(request['baseRevision']) && isRecord(request['command'])
      ? handlers.editMap(request as MapEditRequest)
      : (badMapEditRequest('Invalid map edit request.') as MapEditResponse)
  );
  ipcMain.handle(channels.mapUndo, async (_event, request: unknown) =>
    isRecord(request) && isFiniteNumber(request['baseRevision'])
      ? handlers.undoMap(request as MapUndoRequest)
      : (badMapEditRequest('Invalid map undo request.') as MapUndoResponse)
  );
  ipcMain.handle(channels.mapRedo, async (_event, request: unknown) =>
    isRecord(request) && isFiniteNumber(request['baseRevision'])
      ? handlers.redoMap(request as MapRedoRequest)
      : (badMapEditRequest('Invalid map redo request.') as MapRedoResponse)
  );

  ipcMain.handle(channels.stateGet, async () => handlers.getStateSnapshot());
}
