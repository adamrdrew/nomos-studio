import type {
  AssetIndex,
  EditorSettings,
  MapDocument,
  MapDocumentRevision,
  MapGridSettings,
  MapRenderMode
} from '../domain/models';
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
  mapUndo: 'nomos:map:undo',
  mapRedo: 'nomos:map:redo',
  stateGet: 'nomos:state:get',
  stateChanged: 'nomos:state:changed'
} as const;

export type AppStateSnapshot = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapGridSettings: MapGridSettings;
  mapHistory: MapEditHistoryInfo;
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

export type MapEditAtomicCommand =
  | Readonly<{ kind: 'map-edit/delete'; target: MapEditTargetRef }>
  | Readonly<{ kind: 'map-edit/clone'; target: MapEditTargetRef }>
  | Readonly<{
      kind: 'map-edit/move-entity';
      target: Readonly<{ kind: 'entity'; index: number }>;
      to: Readonly<{ x: number; y: number }>;
    }>;

export type MapEditSelectionInput = Readonly<{
  kind: 'map-edit/selection';
  ref: MapEditTargetRef | null;
}>;

export type MapEditCommand =
  | MapEditAtomicCommand
  | Readonly<{
      kind: 'map-edit/transaction';
      label?: string;
      commands: readonly MapEditAtomicCommand[];
      selection?: MapEditSelectionInput;
    }>;

export type MapEditRequest = Readonly<{ baseRevision: MapDocumentRevision; command: MapEditCommand }>;

export type MapEditSelectionEffect =
  | Readonly<{ kind: 'map-edit/selection/keep' }>
  | Readonly<{ kind: 'map-edit/selection/clear'; reason: 'deleted' | 'invalidated' }>
  | Readonly<{ kind: 'map-edit/selection/set'; ref: MapEditTargetRef }>
  | Readonly<{ kind: 'map-edit/selection/remap'; from: MapEditTargetRef; to: MapEditTargetRef }>;

export type MapEditHistoryInfo = Readonly<{
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}>;

export type StateChangedPayload = Readonly<{
  selectionEffect?: MapEditSelectionEffect;
}>;

export type MapEditResult =
  | Readonly<{ kind: 'map-edit/deleted' }>
  | Readonly<{ kind: 'map-edit/cloned'; newRef: MapEditTargetRef }>
  | Readonly<{
      kind: 'map-edit/applied';
      selection: MapEditSelectionEffect;
      history: MapEditHistoryInfo;
    }>;

export type MapEditResponse = Result<MapEditResult, MapEditError>;

export type MapEditHandler = (request: MapEditRequest) => Promise<MapEditResponse>;

export type MapUndoRequest = Readonly<{ baseRevision: MapDocumentRevision; steps?: number }>;
export type MapUndoResponse = Result<MapEditResult, MapEditError>;

export type MapRedoRequest = Readonly<{ baseRevision: MapDocumentRevision; steps?: number }>;
export type MapRedoResponse = Result<MapEditResult, MapEditError>;

export type StateGetResponse = Result<AppStateSnapshot, { message: string }>;
