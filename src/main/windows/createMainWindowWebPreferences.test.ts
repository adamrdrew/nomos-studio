import {
  createMainWindowWebPreferences,
  createMainWindowWebPreferencesForForgeEnvironment
} from './createMainWindowWebPreferences';

describe('createMainWindowWebPreferences', () => {
  it('uses secure defaults and enables devTools in dev', () => {
    const preferences = createMainWindowWebPreferences({
      preloadPath: '/preload.js',
      isDev: true
    });

    expect(preferences.preload).toBe('/preload.js');
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.sandbox).toBe(true);
    expect(preferences.webSecurity).toBe(true);
    expect(preferences.devTools).toBe(true);
    expect(preferences.nodeIntegrationInWorker).toBe(false);
    expect(preferences.nodeIntegrationInSubFrames).toBe(false);
  });

  it('uses secure defaults and disables devTools in prod', () => {
    const preferences = createMainWindowWebPreferences({
      preloadPath: '/preload.js',
      isDev: false
    });

    expect(preferences.preload).toBe('/preload.js');
    expect(preferences.devTools).toBe(false);
  });
});

describe('createMainWindowWebPreferencesForForgeEnvironment', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    (globalThis as unknown as { MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string }).MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY =
      '/forge-preload.js';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('disables devTools when NODE_ENV is production', () => {
    process.env['NODE_ENV'] = 'production';

    const preferences = createMainWindowWebPreferencesForForgeEnvironment();

    expect(preferences.preload).toBe('/forge-preload.js');
    expect(preferences.devTools).toBe(false);
  });

  it('enables devTools when NODE_ENV is not production', () => {
    process.env['NODE_ENV'] = 'development';

    const preferences = createMainWindowWebPreferencesForForgeEnvironment();

    expect(preferences.preload).toBe('/forge-preload.js');
    expect(preferences.devTools).toBe(true);
  });
});
