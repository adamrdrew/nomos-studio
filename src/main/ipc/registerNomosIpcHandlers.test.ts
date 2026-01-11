import { registerNomosIpcHandlers } from './registerNomosIpcHandlers';
import { NOMOS_IPC_CHANNELS } from '../../shared/ipc/nomosIpc';

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
        getSettings: async () => ({ ok: true, value: { assetsDirPath: null, gameExecutablePath: null } }),
        updateSettings: async () => ({ ok: true, value: { assetsDirPath: null, gameExecutablePath: null } }),
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
        openMap: async () => ({ ok: false, error: { kind: 'map-io-error', code: 'map-io/read-failed', message: 'nope' } }),
        saveMap: async () => ({ ok: false, error: { kind: 'map-io-error', code: 'map-io/no-document', message: 'nope' } }),
        getStateSnapshot: async () => ({
          ok: true,
          value: {
            settings: { assetsDirPath: null, gameExecutablePath: null },
            assetIndex: null,
            mapDocument: null,
            mapRenderMode: 'wireframe',
            mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 }
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
      channels.mapOpen,
      channels.mapSave,
      channels.stateGet
    ]);
  });
});
