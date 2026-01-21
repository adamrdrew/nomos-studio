import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { createMainWindow } from './windows/createMainWindow';
import { createSettingsWindow } from './windows/createSettingsWindow';

import { SettingsService } from './application/settings/SettingsService';
import { AssetIndexService } from './application/assets/AssetIndexService';
import { OpenAssetService } from './application/assets/OpenAssetService';
import { ReadAssetFileBytesService } from './application/assets/ReadAssetFileBytesService';
import { AppStore } from './application/store/AppStore';
import { JsonFileSettingsRepository } from './infrastructure/settings/JsonFileSettingsRepository';
import { nodeFileSystem } from './infrastructure/settings/nodeFileSystem';
import { registerNomosIpcHandlers } from './ipc/registerNomosIpcHandlers';
import { NOMOS_IPC_CHANNELS } from '../shared/ipc/nomosIpc';
import { AssetIndexer } from './infrastructure/assets/AssetIndexer';
import { nodeDirectoryReader } from './infrastructure/assets/nodeDirectoryReader';
import { nodeBinaryFileReader } from './infrastructure/assets/nodeBinaryFileReader';
import { nodePathService } from './infrastructure/path/nodePathService';
import { nodeProcessRunner } from './infrastructure/process/NodeProcessRunner';
import { nodeShellOpener } from './infrastructure/shell/nodeShellOpener';
import { MapValidationService } from './application/maps/MapValidationService';
import { OpenMapService } from './application/maps/OpenMapService';
import type { UserNotifier } from './application/ui/UserNotifier';
import { SaveMapService } from './application/maps/SaveMapService';
import { MapEditService } from './application/maps/MapEditService';
import { MapCommandEngine } from './application/maps/MapCommandEngine';
import { MapEditHistory } from './application/maps/MapEditHistory';
import type { NomosIpcHandlers } from './ipc/registerNomosIpcHandlers';
import { createApplicationMenuTemplate } from './infrastructure/menu/createApplicationMenuTemplate';
import type { MapRenderMode, MapSectorSurface } from '../shared/domain/models';
import type { StateChangedPayload } from '../shared/ipc/nomosIpc';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const setApplicationMenu = (
  options: Readonly<{
    store: AppStore;
    onOpenSettings: () => void;
    onOpenMap: () => Promise<void>;
    onSave: () => Promise<void>;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => Promise<void>;
    onRedo: () => Promise<void>;
    onRefreshAssetsIndex: () => Promise<void>;
    onSetMapRenderMode: (mode: MapRenderMode) => void;
    onSetMapSectorSurface: (surface: MapSectorSurface) => void;
    onToggleMapHighlightPortals: () => void;
    onToggleMapDoorVisibility: () => void;
    onToggleMapGrid: () => void;
    onIncreaseMapGridOpacity: () => void;
    onDecreaseMapGridOpacity: () => void;
  }>
): void => {
  const canSave = options.store.getState().mapDocument !== null;
  const canUndo = options.canUndo;
  const canRedo = options.canRedo;
  const mapRenderMode = options.store.getState().mapRenderMode;
  const mapSectorSurface = options.store.getState().mapSectorSurface;
  const mapGridSettings = options.store.getState().mapGridSettings;
  const mapHighlightPortals = options.store.getState().mapHighlightPortals;
  const mapDoorVisibility = options.store.getState().mapDoorVisibility;

  const template = createApplicationMenuTemplate({
    appName: app.name,
    platform: process.platform,
    canSave,
    canUndo,
    canRedo,
    mapRenderMode,
    mapSectorSurface,
    mapGridSettings,
    mapHighlightPortals,
    mapDoorVisibility,
    onOpenSettings: options.onOpenSettings,
    onOpenMap: () => void options.onOpenMap(),
    onSave: () => void options.onSave(),
    onUndo: () => void options.onUndo(),
    onRedo: () => void options.onRedo(),
    onRefreshAssetsIndex: () => void options.onRefreshAssetsIndex(),
    onSetMapRenderMode: (mode) => options.onSetMapRenderMode(mode),
    onSetMapSectorSurface: (surface) => options.onSetMapSectorSurface(surface),
    onToggleMapHighlightPortals: () => options.onToggleMapHighlightPortals(),
    onToggleMapDoorVisibility: () => options.onToggleMapDoorVisibility(),
    onToggleMapGrid: () => options.onToggleMapGrid(),
    onIncreaseMapGridOpacity: () => options.onIncreaseMapGridOpacity(),
    onDecreaseMapGridOpacity: () => options.onDecreaseMapGridOpacity()
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Debug: helps confirm menu is actually being installed.
  // Safe to keep: logs only labels and platform.
  try {
    const topLabels = template.map((item) => item.label ?? '<no-label>');
    // eslint-disable-next-line no-console
    console.log('[nomos] menu installed', { platform: process.platform, topLabels });
  } catch (_error: unknown) {
    // Best effort.
  }
};

const createWindowOnceReady = async (): Promise<void> => {
  if (mainWindow !== null) {
    return;
  }

  mainWindow = await createMainWindow();

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      // eslint-disable-next-line no-console
      console.log('[renderer:console]', message);
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // eslint-disable-next-line no-console
      console.log('[renderer:did-fail-load]', { errorCode, errorDescription, validatedURL });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createSettingsWindowOnceReady = async (): Promise<void> => {
  if (settingsWindow !== null) {
    return;
  }

  settingsWindow = await createSettingsWindow();

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

app.on('ready', () => {
  const store = new AppStore();

  const GRID_OPACITY_STEP = 0.1;
  const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

  const settingsRepository = new JsonFileSettingsRepository({
    fs: nodeFileSystem,
    userDataDirPath: app.getPath('userData')
  });
  const settingsService = new SettingsService(settingsRepository);

  const assetIndexer = new AssetIndexer({
    directoryReader: nodeDirectoryReader,
    nowIso: () => new Date().toISOString()
  });
  const assetIndexService = new AssetIndexService(store, assetIndexer);
  const openAssetService = new OpenAssetService(store, nodePathService, nodeShellOpener);
  const readAssetFileBytesService = new ReadAssetFileBytesService(store, nodePathService, nodeBinaryFileReader);

  const mapValidationService = new MapValidationService(store, nodeProcessRunner, () => new Date().toISOString());

  const notifier: UserNotifier = {
    showError: async (title, message, detail) => {
      if (mainWindow === null) {
        return;
      }
      const options = {
        type: 'error',
        title,
        message
      } as const;

      await dialog.showMessageBox(mainWindow, detail === undefined ? options : { ...options, detail });
    },
    showInfo: async (title, message, detail) => {
      if (mainWindow === null) {
        return;
      }
      const options = {
        type: 'info',
        title,
        message
      } as const;

      await dialog.showMessageBox(mainWindow, detail === undefined ? options : { ...options, detail });
    }
  };

  const mapEditHistory = new MapEditHistory(100);
  const mapCommandEngine = new MapCommandEngine();

  const openMapService = new OpenMapService(store, mapValidationService, nodeFileSystem, notifier, mapEditHistory);
  const saveMapService = new SaveMapService(store, nodeFileSystem, notifier);
  const mapEditService = new MapEditService(store, mapCommandEngine, mapEditHistory);

  const sendSelectionEffect = (selectionEffect: StateChangedPayload['selectionEffect']): void => {
    if (mainWindow === null) {
      return;
    }

    if (selectionEffect === undefined) {
      return;
    }

    const payload: StateChangedPayload = { selectionEffect };
    mainWindow.webContents.send(NOMOS_IPC_CHANNELS.stateChanged, payload);
  };

  void (async () => {
    const settingsResult = await settingsService.getSettings();
    if (settingsResult.ok) {
      store.setSettings(settingsResult.value);
      if (settingsResult.value.assetsDirPath !== null) {
        await assetIndexService.refreshIndex();
      }
    }
  })();

  const nomosHandlers: NomosIpcHandlers = {
    getSettings: async () => settingsService.getSettings(),
    updateSettings: async (updates) => {
      const currentAssetsDirPath = store.getState().settings.assetsDirPath;
      const result = await settingsService.updateSettings(updates);
      if (result.ok) {
        store.setSettings(result.value);
        const nextAssetsDirPath = result.value.assetsDirPath;
        if (nextAssetsDirPath !== null && nextAssetsDirPath !== currentAssetsDirPath) {
          await assetIndexService.refreshIndex();
        }
      }
      return result;
    },

    pickDirectory: async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory']
        });

        const chosen = result.canceled ? null : (result.filePaths[0] ?? null);
        return { ok: true as const, value: chosen };
      } catch (_error: unknown) {
        return { ok: false as const, error: { message: 'Failed to open directory picker' } };
      }
    },
    pickFile: async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile']
        });

        const chosen = result.canceled ? null : (result.filePaths[0] ?? null);
        return { ok: true as const, value: chosen };
      } catch (_error: unknown) {
        return { ok: false as const, error: { message: 'Failed to open file picker' } };
      }
    },
    openMapDialog: async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        const chosen = result.canceled ? null : (result.filePaths[0] ?? null);
        return { ok: true as const, value: chosen };
      } catch (_error: unknown) {
        return { ok: false as const, error: { message: 'Failed to open map dialog' } };
      }
    },

    refreshAssetIndex: async () => assetIndexService.refreshIndex(),
    openAsset: async (request) => openAssetService.openAsset(request.relativePath),
    readAssetFileBytes: async (request) => readAssetFileBytesService.readFileBytes(request.relativePath),

    validateMap: async (request) => {
      const result = await mapValidationService.validateMap(request.mapPath);
      if (result.ok) {
        return { ok: true as const, value: null };
      }
      return { ok: false as const, error: result.error };
    },
    openMap: async (request) => openMapService.openMap(request.mapPath),
    saveMap: async () => saveMapService.saveCurrentDocument(),
    editMap: async (request) => mapEditService.edit(request),
    undoMap: async (request) => mapEditService.undo(request),
    redoMap: async (request) => mapEditService.redo(request),

    getStateSnapshot: async () => {
      return {
        ok: true as const,
        value: {
          settings: store.getState().settings,
          assetIndex: store.getState().assetIndex,
          mapDocument: store.getState().mapDocument,
          mapRenderMode: store.getState().mapRenderMode,
          mapSectorSurface: store.getState().mapSectorSurface,
          mapGridSettings: store.getState().mapGridSettings,
          mapHighlightPortals: store.getState().mapHighlightPortals,
          mapDoorVisibility: store.getState().mapDoorVisibility,
          mapHistory: mapEditHistory.getInfo()
        }
      };
    }
  };

  registerNomosIpcHandlers(ipcMain, NOMOS_IPC_CHANNELS, nomosHandlers);

  void createWindowOnceReady();

  const openSettings = (): void => {
    void (async () => {
      await createSettingsWindowOnceReady();
      if (settingsWindow === null) {
        return;
      }

      settingsWindow.show();
      settingsWindow.focus();
    })();
  };

  const openMap = async (): Promise<void> => {
    if (mainWindow === null) {
      return;
    }
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (dialogResult.canceled) {
      return;
    }

    const mapPath = dialogResult.filePaths[0];
    if (mapPath === undefined) {
      return;
    }

    await nomosHandlers.openMap({ mapPath });
  };

  const save = async (): Promise<void> => {
    if (mainWindow === null) {
      return;
    }
    await nomosHandlers.saveMap();
  };

  const refreshAssetsIndex = async (): Promise<void> => {
    if (mainWindow === null) {
      return;
    }
    const result = await nomosHandlers.refreshAssetIndex();
    if (result.ok) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Assets Index Refreshed',
        message: `Indexed ${result.value.stats.fileCount} files.`
      });
    } else {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Assets Index Failed',
        message: result.error.message
      });
    }
  };

  setApplicationMenu({
    store,
    onOpenSettings: openSettings,
    onOpenMap: openMap,
    onSave: save,
    canUndo: mapEditHistory.getInfo().canUndo,
    canRedo: mapEditHistory.getInfo().canRedo,
    onUndo: async () => {
      const result = mapEditService.undo();
      if (result.ok && result.value.kind === 'map-edit/applied') {
        sendSelectionEffect(result.value.selection);
      }
    },
    onRedo: async () => {
      const result = mapEditService.redo();
      if (result.ok && result.value.kind === 'map-edit/applied') {
        sendSelectionEffect(result.value.selection);
      }
    },
    onRefreshAssetsIndex: refreshAssetsIndex,
    onSetMapRenderMode: (mode) => store.setMapRenderMode(mode),
    onSetMapSectorSurface: (surface) => store.setMapSectorSurface(surface),
    onToggleMapHighlightPortals: () => store.toggleMapHighlightPortals(),
    onToggleMapDoorVisibility: () => store.toggleMapDoorVisibility(),
    onToggleMapGrid: () => store.setMapGridIsVisible(!store.getState().mapGridSettings.isGridVisible),
    onIncreaseMapGridOpacity: () =>
      store.setMapGridOpacity(roundToTenth(store.getState().mapGridSettings.gridOpacity + GRID_OPACITY_STEP)),
    onDecreaseMapGridOpacity: () =>
      store.setMapGridOpacity(roundToTenth(store.getState().mapGridSettings.gridOpacity - GRID_OPACITY_STEP))
  });

  store.subscribe(() => {
    setApplicationMenu({
      store,
      onOpenSettings: openSettings,
      onOpenMap: openMap,
      onSave: save,
      canUndo: mapEditHistory.getInfo().canUndo,
      canRedo: mapEditHistory.getInfo().canRedo,
      onUndo: async () => {
        const result = mapEditService.undo();
        if (result.ok && result.value.kind === 'map-edit/applied') {
          sendSelectionEffect(result.value.selection);
        }
      },
      onRedo: async () => {
        const result = mapEditService.redo();
        if (result.ok && result.value.kind === 'map-edit/applied') {
          sendSelectionEffect(result.value.selection);
        }
      },
      onRefreshAssetsIndex: refreshAssetsIndex,
      onSetMapRenderMode: (mode) => store.setMapRenderMode(mode),
      onSetMapSectorSurface: (surface) => store.setMapSectorSurface(surface),
      onToggleMapHighlightPortals: () => store.toggleMapHighlightPortals(),
      onToggleMapDoorVisibility: () => store.toggleMapDoorVisibility(),
      onToggleMapGrid: () => store.setMapGridIsVisible(!store.getState().mapGridSettings.isGridVisible),
      onIncreaseMapGridOpacity: () =>
        store.setMapGridOpacity(roundToTenth(store.getState().mapGridSettings.gridOpacity + GRID_OPACITY_STEP)),
      onDecreaseMapGridOpacity: () =>
        store.setMapGridOpacity(roundToTenth(store.getState().mapGridSettings.gridOpacity - GRID_OPACITY_STEP))
    });

    if (mainWindow !== null) {
      mainWindow.webContents.send(NOMOS_IPC_CHANNELS.stateChanged);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  void createWindowOnceReady();
});
