import type { AssetIndex, EditorSettings, MapDocument, MapGridSettings, MapRenderMode } from '../domain/models';
import type {
  AssetIndexError,
  MapEditError,
  MapIoError,
  MapValidationError,
  OpenAssetError,
  ReadAssetError,
  Result,
  SettingsError
} from '../domain/results';

export const NOMOS_IPC_CHANNELS = {
  settingsGet: 'nomos:settings:get',
  settingsUpdate: 'nomos:settings:update',
  dialogsPickDirectory: 'nomos:dialogs:pick-directory',
  dialogsPickFile: 'nomos:dialogs:pick-file',
  dialogsOpenMap: 'nomos:dialogs:open-map',
  assetsRefreshIndex: 'nomos:assets:refresh-index',
  assetsOpen: 'nomos:assets:open',
  assetsReadFileBytes: 'nomos:assets:read-file-bytes',
  mapValidate: 'nomos:map:validate',
  mapOpen: 'nomos:map:open',
  mapSave: 'nomos:map:save',
  mapEdit: 'nomos:map:edit',
  stateGet: 'nomos:state:get',
  stateChanged: 'nomos:state:changed'
} as const;

export type AppStateSnapshot = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapGridSettings: MapGridSettings;
}>;

export type SettingsGetResponse = Result<EditorSettings, SettingsError>;
export type SettingsUpdateRequest = Partial<EditorSettings>;
export type SettingsUpdateResponse = Result<EditorSettings, SettingsError>;

export type PickDirectoryResponse = Result<string | null, { message: string }>;
export type PickFileResponse = Result<string | null, { message: string }>;
export type OpenMapDialogResponse = Result<string | null, { message: string }>;

export type RefreshAssetIndexResponse = Result<AssetIndex, AssetIndexError>;

export type OpenAssetRequest = Readonly<{ relativePath: string }>;
export type OpenAssetResponse = Result<null, OpenAssetError>;

export type ReadAssetFileBytesRequest = Readonly<{ relativePath: string }>;
export type ReadAssetFileBytesResponse = Result<Uint8Array, ReadAssetError>;

export type ValidateMapRequest = Readonly<{ mapPath: string }>;
export type ValidateMapResponse = Result<null, MapValidationError>;

export type OpenMapRequest = Readonly<{ mapPath: string }>;
export type OpenMapResponse = Result<MapDocument, MapIoError | MapValidationError>;

export type SaveMapResponse = Result<MapDocument, MapIoError>;

export type MapEditTargetRef =
  | Readonly<{ kind: 'light'; index: number }>
  | Readonly<{ kind: 'particle'; index: number }>
  | Readonly<{ kind: 'entity'; index: number }>
  | Readonly<{ kind: 'door'; id: string }>;

export type MapEditCommand =
  | Readonly<{ kind: 'map-edit/delete'; target: MapEditTargetRef }>
  | Readonly<{ kind: 'map-edit/clone'; target: MapEditTargetRef }>;

export type MapEditRequest = Readonly<{ command: MapEditCommand }>;

export type MapEditResult =
  | Readonly<{ kind: 'map-edit/deleted' }>
  | Readonly<{ kind: 'map-edit/cloned'; newRef: MapEditTargetRef }>;

export type MapEditResponse = Result<MapEditResult, MapEditError>;

export type MapEditHandler = (request: MapEditRequest) => Promise<MapEditResponse>;

export type StateGetResponse = Result<AppStateSnapshot, { message: string }>;
