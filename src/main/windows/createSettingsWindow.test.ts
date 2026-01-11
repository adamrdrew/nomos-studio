import { createSettingsWindow } from './createSettingsWindow';
import { createMainWindowWebPreferencesForForgeEnvironment } from './createMainWindowWebPreferences';

jest.mock('electron', () => {
  type ReadyToShowHandler = () => void;

  let lastInstance: unknown;

  const BrowserWindow = jest.fn().mockImplementation((options: unknown) => {
    const onceHandlers = new Map<string, ReadyToShowHandler>();

    const instance = {
      __options: options,
      __onceHandlers: onceHandlers,
      once: jest.fn((eventName: string, handler: ReadyToShowHandler) => {
        onceHandlers.set(eventName, handler);
      }),
      show: jest.fn(),
      focus: jest.fn(),
      loadURL: jest.fn(async (url: string) => {
        void url;
        return undefined;
      })
    };

    lastInstance = instance;

    return instance;
  });

  return {
    BrowserWindow,
    __getLastInstance: () => lastInstance
  };
});

jest.mock('./createMainWindowWebPreferences', () => ({
  createMainWindowWebPreferencesForForgeEnvironment: jest.fn()
}));

describe('createSettingsWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (globalThis as unknown as { MAIN_WINDOW_WEBPACK_ENTRY: string }).MAIN_WINDOW_WEBPACK_ENTRY =
      'http://localhost:1234/test';
  });

  it('constructs a BrowserWindow with expected options and loads the Forge entry with nomosSettings=1', async () => {
    const expectedWebPreferences = { sentinel: 'web-preferences' };

    const createWebPreferencesMock =
      createMainWindowWebPreferencesForForgeEnvironment as unknown as jest.Mock;
    createWebPreferencesMock.mockReturnValue(expectedWebPreferences);

    const electronMock = jest.requireMock('electron') as {
      BrowserWindow: jest.Mock;
      __getLastInstance: () => unknown;
    };

    const settingsWindow = await createSettingsWindow();

    expect(createMainWindowWebPreferencesForForgeEnvironment).toHaveBeenCalledTimes(1);
    expect(electronMock.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(electronMock.BrowserWindow).toHaveBeenCalledWith({
      title: 'Settings',
      width: 720,
      height: 520,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: expectedWebPreferences
    });

    const instance = electronMock.__getLastInstance() as {
      __onceHandlers: Map<string, () => void>;
      once: jest.Mock;
      show: jest.Mock;
      focus: jest.Mock;
      loadURL: jest.Mock;
    };

    expect(settingsWindow).toBe(instance);

    expect(instance.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
    expect(instance.loadURL).toHaveBeenCalledWith('http://localhost:1234/test?nomosSettings=1');

    const readyToShowHandler = instance.__onceHandlers.get('ready-to-show');
    expect(readyToShowHandler).toBeDefined();

    readyToShowHandler?.();
    expect(instance.show).toHaveBeenCalledTimes(1);
    expect(instance.focus).toHaveBeenCalledTimes(1);
  });

  it('adds the nomosSettings flag when the base URL already has a query string', async () => {
    (globalThis as unknown as { MAIN_WINDOW_WEBPACK_ENTRY: string }).MAIN_WINDOW_WEBPACK_ENTRY =
      'http://localhost:1234/test?foo=bar';

    const electronMock = jest.requireMock('electron') as {
      __getLastInstance: () => unknown;
    };

    await createSettingsWindow();

    const instance = electronMock.__getLastInstance() as {
      loadURL: jest.Mock;
    };

    expect(instance.loadURL).toHaveBeenCalledWith('http://localhost:1234/test?foo=bar&nomosSettings=1');
  });
});
