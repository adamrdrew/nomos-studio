import { registerNomosIpcHandlers } from './registerNomosIpcHandlers';
import { NOMOS_IPC_CHANNELS } from '../../shared/ipc/nomosIpc';

const defaultSettings = {
  assetsDirPath: null,
  gameExecutablePath: null,
  defaultSky: null,
  defaultSoundfont: null,
  defaultBgmusic: null,
  defaultWallTex: null,
  defaultFloorTex: null,
  defaultCeilTex: null
} as const;

describe('registerNomosIpcHandlers', () => {
  it('registers handlers for all expected channels', () => {
    const channels = NOMOS_IPC_CHANNELS;
    const calls: string[] = [];

    const ipcMain = {
      handle: (channel: string) => {
        calls.push(channel);
      }
    };

    registerNomosIpcHandlers(
      ipcMain as unknown as Parameters<typeof registerNomosIpcHandlers>[0],
      channels,
      {
        getSettings: async () => ({ ok: true, value: defaultSettings }),
        updateSettings: async () => ({ ok: true, value: defaultSettings }),
        pickDirectory: async () => ({ ok: true, value: null }),
        pickFile: async () => ({ ok: true, value: null }),
        openMapDialog: async () => ({ ok: true, value: null }),
        refreshAssetIndex: async () => ({
          ok: false,
          error: { kind: 'asset-index-error', code: 'asset-index/read-failed', message: 'nope' }
        }),
        openAsset: async () => ({
          ok: false,
          error: {
            kind: 'open-asset-error',
            code: 'open-asset/open-failed',
            message: 'nope'
          }
        }),
        readAssetFileBytes: async () => ({
          ok: false,
          error: {
            kind: 'read-asset-error',
            code: 'read-asset/read-failed',
            message: 'nope'
          }
        }),
        validateMap: async () => ({
          ok: false,
          error: { kind: 'map-validation-error', code: 'map-validation/runner-failed', message: 'nope' }
        }),
        newMap: async () => ({
          ok: true,
          value: null
        }),
        openMap: async () => ({ ok: false, error: { kind: 'map-io-error', code: 'map-io/read-failed', message: 'nope' } }),
        openMapFromAssets: async () => ({
          ok: false,
          error: {
            kind: 'open-map-from-assets-error',
            code: 'open-map-from-assets/invalid-relative-path',
            message: 'nope'
          }
        }),
        saveMap: async () => ({ ok: false, error: { kind: 'map-io-error', code: 'map-io/no-document', message: 'nope' } }),
        editMap: async () => ({
          ok: false,
          error: { kind: 'map-edit-error', code: 'map-edit/no-document', message: 'nope' }
        }),
        undoMap: async () => ({
          ok: false,
          error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' }
        }),
        redoMap: async () => ({
          ok: false,
          error: { kind: 'map-edit-error', code: 'map-edit/not-found', message: 'nope' }
        }),
        getStateSnapshot: async () => ({
          ok: true,
          value: {
            settings: {
              assetsDirPath: null,
              gameExecutablePath: null,
              defaultSky: null,
              defaultSoundfont: null,
              defaultBgmusic: null,
              defaultWallTex: null,
              defaultFloorTex: null,
              defaultCeilTex: null
            },
            assetIndex: null,
            recentMapPaths: [],
            mapDocument: null,
            mapRenderMode: 'textured',
            mapSectorSurface: 'floor',
            mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
            mapHighlightPortals: false,
            mapHighlightToggleWalls: false,
            mapDoorVisibility: 'visible',
            mapHistory: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
          }
        })
      }
    );

    expect(calls).toEqual([
      channels.settingsGet,
      channels.settingsUpdate,
      channels.dialogsPickDirectory,
      channels.dialogsPickFile,
      channels.dialogsOpenMap,
      channels.assetsRefreshIndex,
      channels.assetsOpen,
      channels.assetsReadFileBytes,
      channels.mapValidate,
      channels.mapNew,
      channels.mapOpen,
      channels.mapOpenFromAssets,
      channels.mapSave,
      channels.mapEdit,
      channels.mapUndo,
      channels.mapRedo,
      channels.stateGet
    ]);
  });
});
