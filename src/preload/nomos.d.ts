export {};

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
  OpenMapResponse,
  PickDirectoryResponse,
  PickFileResponse,
  RefreshAssetIndexResponse,
  SaveMapResponse,
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
      };
      map: {
        validate: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
        open: (request: { mapPath: string }) => Promise<OpenMapResponse>;
        save: () => Promise<SaveMapResponse>;
        edit: (request: MapEditRequest) => Promise<MapEditResponse>;
        undo: (request?: MapUndoRequest) => Promise<MapUndoResponse>;
        redo: (request?: MapRedoRequest) => Promise<MapRedoResponse>;
      };
      state: {
        getSnapshot: () => Promise<StateGetResponse>;
        onChanged: (listener: (payload?: StateChangedPayload) => void) => () => void;
      };
    };
  }
}
