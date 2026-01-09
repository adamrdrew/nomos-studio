import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/createMainWindow';

let mainWindow: BrowserWindow | null = null;

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
  void createWindowOnceReady();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  void createWindowOnceReady();
});
