import type { AssetIndex, EditorSettings, MapDocument } from '../domain/models';
import type {
  AssetIndexError,
  MapIoError,
  MapValidationError,
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
  mapValidate: 'nomos:map:validate',
  mapOpen: 'nomos:map:open',
  mapSave: 'nomos:map:save',
  stateGet: 'nomos:state:get'
} as const;

export type AppStateSnapshot = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  mapDocument: MapDocument | null;
}>;

export type SettingsGetResponse = Result<EditorSettings, SettingsError>;
export type SettingsUpdateRequest = Partial<EditorSettings>;
export type SettingsUpdateResponse = Result<EditorSettings, SettingsError>;

export type PickDirectoryResponse = Result<string | null, { message: string }>;
export type PickFileResponse = Result<string | null, { message: string }>;
export type OpenMapDialogResponse = Result<string | null, { message: string }>;

export type RefreshAssetIndexResponse = Result<AssetIndex, AssetIndexError>;

export type ValidateMapRequest = Readonly<{ mapPath: string }>;
export type ValidateMapResponse = Result<null, MapValidationError>;

export type OpenMapRequest = Readonly<{ mapPath: string }>;
export type OpenMapResponse = Result<MapDocument, MapIoError | MapValidationError>;

export type SaveMapResponse = Result<MapDocument, MapIoError>;

export type StateGetResponse = Result<AppStateSnapshot, { message: string }>;
