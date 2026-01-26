export {};

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
  ReadAssetFileBytesRequest,
  ReadAssetFileBytesResponse,
  ReadAssetJsonTextRequest,
  ReadAssetJsonTextResponse,
  WriteAssetJsonTextRequest,
  WriteAssetJsonTextResponse,
  OpenMapDialogResponse,
  OpenMapFromAssetsRequest,
  OpenMapFromAssetsResponse,
  OpenMapResponse,
  PickDirectoryResponse,
  PickFileResponse,
  RefreshAssetIndexResponse,
  SaveMapResponse,
  SaveAndRunMapResponse,
  SettingsGetResponse,
  SettingsUpdateRequest,
  SettingsUpdateResponse,
  StateChangedPayload,
  StateGetResponse,
  ValidateMapRequest,
  ValidateMapResponse
} from '../shared/ipc/nomosIpc';

declare global {
  interface Window {
    nomos: {
      version: string;
      menu: {
        onSaveRequested: (listener: () => void) => () => void;
        onSaveAndRunRequested: (listener: () => void) => () => void;
      };
      settings: {
        get: () => Promise<SettingsGetResponse>;
        update: (updates: SettingsUpdateRequest) => Promise<SettingsUpdateResponse>;
      };
      dialogs: {
        pickDirectory: () => Promise<PickDirectoryResponse>;
        pickFile: () => Promise<PickFileResponse>;
        openMap: () => Promise<OpenMapDialogResponse>;
      };
      assets: {
        refreshIndex: () => Promise<RefreshAssetIndexResponse>;
        open: (request: OpenAssetRequest) => Promise<OpenAssetResponse>;
        readFileBytes: (request: ReadAssetFileBytesRequest) => Promise<ReadAssetFileBytesResponse>;
        readJsonText: (request: ReadAssetJsonTextRequest) => Promise<ReadAssetJsonTextResponse>;
        writeJsonText: (request: WriteAssetJsonTextRequest) => Promise<WriteAssetJsonTextResponse>;
      };
      map: {
        validate: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
        new: () => Promise<NewMapResponse>;
        open: (request: { mapPath: string }) => Promise<OpenMapResponse>;
        openFromAssets: (request: OpenMapFromAssetsRequest) => Promise<OpenMapFromAssetsResponse>;
        save: () => Promise<SaveMapResponse>;
        saveAndRun: () => Promise<SaveAndRunMapResponse>;
        edit: (request: MapEditRequest) => Promise<MapEditResponse>;
        undo: (request: MapUndoRequest) => Promise<MapUndoResponse>;
        redo: (request: MapRedoRequest) => Promise<MapRedoResponse>;
      };
      state: {
        getSnapshot: () => Promise<StateGetResponse>;
        onChanged: (listener: (payload?: StateChangedPayload) => void) => () => void;
      };
    };
  }
}
