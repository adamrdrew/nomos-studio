import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';
import { createMainWindow } from './windows/createMainWindow';

import { SettingsService } from './application/settings/SettingsService';
import { AssetIndexService } from './application/assets/AssetIndexService';
import { AppStore } from './application/store/AppStore';
import { JsonFileSettingsRepository } from './infrastructure/settings/JsonFileSettingsRepository';
import { nodeFileSystem } from './infrastructure/settings/nodeFileSystem';
import { registerNomosIpcHandlers } from './ipc/registerNomosIpcHandlers';
import { NOMOS_IPC_CHANNELS, NOMOS_IPC_EVENTS } from '../shared/ipc/nomosIpc';
import { AssetIndexer } from './infrastructure/assets/AssetIndexer';
import { nodeDirectoryReader } from './infrastructure/assets/nodeDirectoryReader';
import { nodeProcessRunner } from './infrastructure/process/NodeProcessRunner';
import { MapValidationService } from './application/maps/MapValidationService';
import { OpenMapService } from './application/maps/OpenMapService';
import type { UserNotifier } from './application/ui/UserNotifier';
import { SaveMapService } from './application/maps/SaveMapService';
import type { NomosIpcHandlers } from './ipc/registerNomosIpcHandlers';

let mainWindow: BrowserWindow | null = null;

const setApplicationMenu = (
  options: Readonly<{
    store: AppStore;
    onOpenSettings: () => void;
    onOpenMap: () => Promise<void>;
    onSave: () => Promise<void>;
    onRefreshAssetsIndex: () => Promise<void>;
  }>
): void => {
  const canSave = options.store.getState().mapDocument !== null;

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'Open Map…', click: () => void options.onOpenMap() },
      { label: 'Save', enabled: canSave, click: () => void options.onSave() },
      { type: 'separator' },
      { label: 'Refresh Assets Index', click: () => void options.onRefreshAssetsIndex() }
    ]
  };

  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { label: 'Settings…', click: options.onOpenSettings },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  template.push(fileMenu);

  if (process.platform !== 'darwin') {
    template.push({
      label: 'Edit',
      submenu: [
        { label: 'Settings…', click: options.onOpenSettings },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindowOnceReady = async (): Promise<void> => {
  if (mainWindow !== null) {
    return;
  }

  mainWindow = await createMainWindow();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  const store = new AppStore();

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

  const openMapService = new OpenMapService(store, mapValidationService, nodeFileSystem, notifier);
  const saveMapService = new SaveMapService(store, nodeFileSystem, notifier);

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

    validateMap: async (request) => {
      const result = await mapValidationService.validateMap(request.mapPath);
      if (result.ok) {
        return { ok: true as const, value: null };
      }
      return { ok: false as const, error: result.error };
    },
    openMap: async (request) => openMapService.openMap(request.mapPath),
    saveMap: async () => saveMapService.saveCurrentDocument(),

    getStateSnapshot: async () => {
      return {
        ok: true as const,
        value: {
          settings: store.getState().settings,
          assetIndex: store.getState().assetIndex,
          mapDocument: store.getState().mapDocument
        }
      };
    }
  };

  registerNomosIpcHandlers(ipcMain, NOMOS_IPC_CHANNELS, nomosHandlers);

  void createWindowOnceReady();

  const openSettings = (): void => {
    if (mainWindow === null) {
      return;
    }
    mainWindow.webContents.send(NOMOS_IPC_EVENTS.uiOpenSettings);
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
    onRefreshAssetsIndex: refreshAssetsIndex
  });

  store.subscribe(() => {
    setApplicationMenu({
      store,
      onOpenSettings: openSettings,
      onOpenMap: openMap,
      onSave: save,
      onRefreshAssetsIndex: refreshAssetsIndex
    });
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
