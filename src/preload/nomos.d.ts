export {};

import type {
  OpenMapDialogResponse,
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
      };
      map: {
        validate: (request: ValidateMapRequest) => Promise<ValidateMapResponse>;
        open: (request: { mapPath: string }) => Promise<OpenMapResponse>;
        save: () => Promise<SaveMapResponse>;
      };
      state: {
        getSnapshot: () => Promise<StateGetResponse>;
      };
    };
  }
}
