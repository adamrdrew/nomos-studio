import { BrowserWindow } from 'electron';
import { createMainWindowWebPreferencesForForgeEnvironment } from './createMainWindowWebPreferences';

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: createMainWindowWebPreferencesForForgeEnvironment()
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  return mainWindow;
}
