import type { WebPreferences } from 'electron';

export type MainWindowWebPreferencesDependencies = {
  preloadPath: string;
  isDev: boolean;
};

export function createMainWindowWebPreferences(
  dependencies: MainWindowWebPreferencesDependencies
): WebPreferences {
  return {
    preload: dependencies.preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: dependencies.isDev,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false
  };
}

export function createMainWindowWebPreferencesForForgeEnvironment(): WebPreferences {
  return createMainWindowWebPreferences({
    preloadPath: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    isDev: process.env['NODE_ENV'] !== 'production'
  });
}
