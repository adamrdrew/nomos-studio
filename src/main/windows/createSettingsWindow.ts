import { BrowserWindow } from 'electron';
import { createMainWindowWebPreferencesForForgeEnvironment } from './createMainWindowWebPreferences';

function settingsWindowUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('nomosSettings', '1');
    return url.toString();
  } catch (_error: unknown) {
    // Fallback: best-effort string append.
    const hasQuery = baseUrl.includes('?');
    return `${baseUrl}${hasQuery ? '&' : '?'}nomosSettings=1`;
  }
}

export async function createSettingsWindow(): Promise<BrowserWindow> {
  const settingsWindow = new BrowserWindow({
    title: 'Settings',
    width: 720,
    height: 520,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: createMainWindowWebPreferencesForForgeEnvironment()
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
  });

  await settingsWindow.loadURL(settingsWindowUrl(MAIN_WINDOW_WEBPACK_ENTRY));

  return settingsWindow;
}
